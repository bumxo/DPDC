"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

export interface ImportResult {
  error?: string;
  created?: number;
  updated?: number;
  uoms?: number;
  rowErrors?: string[];
}

interface ImportRow {
  sku: string;
  name: string;
  description: string | null;
  uom: string;
  units_per_uom: number;
  price: number;
  stock_qty: number | null;
  is_active: boolean;
}

function normalizeHeader(h: string) {
  return h.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function parseSheet(buffer: ArrayBuffer): { rows: ImportRow[]; errors: string[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === "products") ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const rows: ImportRow[] = [];
  const errors: string[] = [];

  raw.forEach((entry, idx) => {
    const rowNum = idx + 2; // 1-based + header row
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) r[normalizeHeader(k)] = v;

    const sku = String(r.sku ?? "").trim();
    const name = String(r.name ?? "").trim();
    const uom = String(r.uom ?? "").trim() || "Piece";
    if (!sku && !name) return; // skip fully blank rows
    if (!sku) {
      errors.push(`Row ${rowNum}: missing SKU`);
      return;
    }

    const unitsPerUom = Number(r.units_per_uom ?? 1) || 1;
    const price = Number(r.price);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Row ${rowNum} (${sku}): invalid price "${r.price}"`);
      return;
    }
    if (!Number.isInteger(unitsPerUom) || unitsPerUom <= 0) {
      errors.push(`Row ${rowNum} (${sku}): invalid units_per_uom "${r.units_per_uom}"`);
      return;
    }

    const stockRaw = String(r.stock_qty ?? "").trim();
    const stock = stockRaw === "" ? null : Number(stockRaw);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
      errors.push(`Row ${rowNum} (${sku}): invalid stock_qty "${stockRaw}"`);
      return;
    }

    const activeRaw = String(r.is_active ?? "").trim().toLowerCase();
    const isActive = !["false", "0", "no", "n"].includes(activeRaw);

    rows.push({
      sku,
      name,
      description: String(r.description ?? "").trim() || null,
      uom,
      units_per_uom: unitsPerUom,
      price,
      stock_qty: stock,
      is_active: isActive,
    });
  });

  return { rows, errors };
}

export async function importProducts(
  _prev: ImportResult,
  formData: FormData
): Promise<ImportResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Admin access required." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an .xlsx file to upload." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "File is too large (max 5 MB)." };
  }

  let parsed: ReturnType<typeof parseSheet>;
  try {
    parsed = parseSheet(await file.arrayBuffer());
  } catch {
    return { error: "Could not read the file. Make sure it is a valid .xlsx workbook." };
  }

  const { rows, errors } = parsed;
  if (rows.length === 0) {
    return {
      error: "No valid product rows found in the file.",
      rowErrors: errors,
    };
  }

  // Group rows by SKU: first row supplies product fields, every row adds a UOM.
  const bySku = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const list = bySku.get(row.sku) ?? [];
    list.push(row);
    bySku.set(row.sku, list);
  }

  let created = 0;
  let updated = 0;
  let uomCount = 0;

  for (const [sku, group] of Array.from(bySku.entries())) {
    const head = group[0];
    const defaultUom = group.reduce((min, r) =>
      r.units_per_uom < min.units_per_uom ? r : min
    );

    const productFields = {
      unit_price: defaultUom.price,
      is_active: head.is_active,
      ...(head.name ? { name: head.name } : {}),
      ...(head.description !== null ? { description: head.description } : {}),
      ...(head.stock_qty !== null ? { stock_qty: head.stock_qty } : {}),
    };

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("sku", sku)
      .maybeSingle();

    let productId: string;
    if (existing) {
      const { error } = await supabase
        .from("products")
        .update(productFields)
        .eq("id", existing.id);
      if (error) {
        errors.push(`${sku}: ${error.message}`);
        continue;
      }
      productId = existing.id;
      updated += 1;
    } else {
      if (!head.name) {
        errors.push(`${sku}: new product is missing a name`);
        continue;
      }
      const { data: inserted, error } = await supabase
        .from("products")
        .insert({ sku, stock_qty: head.stock_qty ?? 0, ...productFields })
        .select("id")
        .single();
      if (error || !inserted) {
        errors.push(`${sku}: ${error?.message ?? "insert failed"}`);
        continue;
      }
      productId = inserted.id;
      created += 1;
    }

    // Replace the product's UOM list with what the file specifies.
    const { error: deleteError } = await supabase
      .from("product_uoms")
      .delete()
      .eq("product_id", productId);
    if (deleteError) {
      errors.push(`${sku}: could not reset UOMs — ${deleteError.message}`);
      continue;
    }

    const { error: uomError } = await supabase.from("product_uoms").insert(
      group.map((r) => ({
        product_id: productId,
        uom: r.uom,
        units_per_uom: r.units_per_uom,
        price: r.price,
        is_default: r === defaultUom,
      }))
    );
    if (uomError) {
      errors.push(`${sku}: UOM insert failed — ${uomError.message}`);
      continue;
    }
    uomCount += group.length;
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "products.imported",
    entity: "import",
    details: {
      file: file.name,
      created,
      updated,
      uoms: uomCount,
      row_errors: errors.length,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/admin");

  return { created, updated, uoms: uomCount, rowErrors: errors };
}
