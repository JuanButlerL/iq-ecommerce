"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ProductColorTheme } from "@prisma/client";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ProductImageInput = {
  filePath: string;
  publicUrl: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
};

type ProductFormProps = {
  mode: "create" | "edit";
  productId?: string;
  initialValue?: {
    name: string;
    slug: string;
    shortDescription: string;
    longDescription: string;
    priceArs: number;
    colorTheme: ProductColorTheme;
    active: boolean;
    visible: boolean;
    manualSoldOut: boolean;
    featured: boolean;
    sortOrder: number;
    images: ProductImageInput[];
  };
};

export function ProductForm({ mode, productId, initialValue }: ProductFormProps) {
  const router = useRouter();
  const [images, setImages] = useState<ProductImageInput[]>(initialValue?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: initialValue?.name ?? "",
    slug: initialValue?.slug ?? "",
    shortDescription: initialValue?.shortDescription ?? "",
    longDescription: initialValue?.longDescription ?? "",
    priceArs: initialValue?.priceArs ?? 21660,
    colorTheme: initialValue?.colorTheme ?? ProductColorTheme.CACAO,
    active: initialValue?.active ?? true,
    visible: initialValue?.visible ?? true,
    manualSoldOut: initialValue?.manualSoldOut ?? false,
    featured: initialValue?.featured ?? false,
    sortOrder: initialValue?.sortOrder ?? 1,
  });

  return (
    <Card className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="font-display text-3xl text-brand-ink md:text-4xl">
          {mode === "create" ? "Nuevo producto" : "Editar producto"}
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          placeholder="Nombre"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
        <Input
          placeholder="Slug"
          value={form.slug}
          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
        />
        <Input
          placeholder="Precio ARS"
          type="number"
          value={form.priceArs}
          onChange={(event) => setForm((current) => ({ ...current, priceArs: Number(event.target.value) }))}
        />
        <Select
          value={form.colorTheme}
          onChange={(event) =>
            setForm((current) => ({ ...current, colorTheme: event.target.value as ProductColorTheme }))
          }
        >
          {Object.values(ProductColorTheme).map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Orden"
          type="number"
          value={form.sortOrder}
          onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
        />
        <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:flex-wrap sm:gap-4">
          <Checkbox
            label="Activo"
            checked={form.active}
            onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
          />
          <Checkbox
            label="Visible"
            checked={form.visible}
            onChange={(event) => setForm((current) => ({ ...current, visible: event.target.checked }))}
          />
          <Checkbox
            label="Sin stock manual"
            checked={form.manualSoldOut}
            onChange={(event) => setForm((current) => ({ ...current, manualSoldOut: event.target.checked }))}
          />
          <Checkbox
            label="Destacado"
            checked={form.featured}
            onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))}
          />
        </div>
        <div className="md:col-span-2">
          <Textarea
            placeholder="Descripcion corta"
            value={form.shortDescription}
            onChange={(event) => setForm((current) => ({ ...current, shortDescription: event.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <Textarea
            placeholder="Descripcion larga"
            value={form.longDescription}
            onChange={(event) => setForm((current) => ({ ...current, longDescription: event.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-4 rounded-[2rem] bg-background p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-bold text-brand-ink">Imagenes</p>
            <p className="text-sm text-brand-ink/60">Subi y ordená las imagenes del producto.</p>
          </div>
          <Input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp"
            className="w-full max-w-sm"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);

              if (files.length === 0) {
                return;
              }

              startTransition(async () => {
                for (const file of files) {
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("slug", form.slug || crypto.randomUUID());
                  const response = await fetch("/api/admin/upload/product-image", {
                    method: "POST",
                    body: formData,
                  });
                  const payload = await response.json();

                  if (!response.ok) {
                    setError(payload.error ?? "No pudimos subir una imagen.");
                    return;
                  }

                  setImages((current) => [
                    ...current,
                    {
                      filePath: payload.data.storagePath,
                      publicUrl: payload.data.publicUrl,
                      altText: `${form.name || "Producto"} imagen ${current.length + 1}`,
                      sortOrder: current.length,
                      isPrimary: current.length === 0,
                    },
                  ]);
                }
              });
            }}
          />
        </div>
        <div className="space-y-3">
          {images.map((image, index) => (
            <div key={`${image.publicUrl}-${index}`} className="flex flex-col gap-3 rounded-[1.5rem] bg-white p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl">
                <Image src={image.publicUrl} alt={image.altText} fill className="object-cover" sizes="80px" />
              </div>
              <Input
                className="sm:min-w-[220px] sm:flex-1"
                value={image.altText}
                onChange={(event) =>
                  setImages((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, altText: event.target.value } : entry,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() =>
                  setImages((current) =>
                    current.map((entry, entryIndex) => ({
                      ...entry,
                      isPrimary: entryIndex === index,
                    })),
                  )
                }
              >
                Principal
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() =>
                  setImages((current) =>
                    current
                      .filter((_, entryIndex) => entryIndex !== index)
                      .map((entry, entryIndex) => ({
                        ...entry,
                        sortOrder: entryIndex,
                        isPrimary: entryIndex === 0 ? entry.isPrimary || index === 0 : false,
                      })),
                  )
                }
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          disabled={isPending}
          className="w-full sm:w-auto"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const response = await fetch(mode === "create" ? "/api/admin/products" : `/api/admin/products/${productId}`, {
                method: mode === "create" ? "POST" : "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  product: form,
                  images: images.map((image, index) => ({
                    ...image,
                    sortOrder: index,
                    isPrimary: image.isPrimary || index === 0,
                  })),
                }),
              });

              const payload = await response.json();

              if (!response.ok) {
                setError(payload.error ?? "No pudimos guardar el producto.");
                return;
              }

              router.push("/admin/productos");
              router.refresh();
            });
          }}
        >
          {isPending ? "Guardando..." : "Guardar producto"}
        </Button>
        {mode === "edit" && productId ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => {
              const confirmed = window.confirm("Esta accion va a desactivar y ocultar el producto. Queres continuar?");

              if (!confirmed) {
                return;
              }

              startTransition(async () => {
                const response = await fetch(`/api/admin/products/${productId}`, {
                  method: "DELETE",
                });

                const payload = await response.json();

                if (!response.ok) {
                  setError(payload.error ?? "No pudimos desactivar el producto.");
                  return;
                }

                router.push("/admin/productos");
                router.refresh();
              });
            }}
          >
            Desactivar producto
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
