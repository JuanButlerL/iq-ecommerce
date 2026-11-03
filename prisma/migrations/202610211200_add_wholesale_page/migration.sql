-- Contenido editable de /mayoristas (fila única "default").
CREATE TABLE "wholesale_page" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "content" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_page_pkey" PRIMARY KEY ("id")
);
