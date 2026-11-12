-- Registros mayoristas: guardan la sesión de marketing (UTM y origen) en la que se registró la persona.
ALTER TABLE "wholesale_leads" ADD COLUMN "marketing_session_id" UUID,
ADD COLUMN "marketing_visitor_id" TEXT;

CREATE INDEX "wholesale_leads_marketing_session_idx" ON "wholesale_leads"("marketing_session_id");
ALTER TABLE "wholesale_leads" ADD CONSTRAINT "wholesale_leads_marketing_session_id_fkey" FOREIGN KEY ("marketing_session_id") REFERENCES "marketing_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
