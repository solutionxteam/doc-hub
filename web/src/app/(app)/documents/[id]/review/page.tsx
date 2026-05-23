import { getMembership }  from "@/lib/get-membership"
import { createClient }   from "@/lib/supabase/server"
import { notFound }       from "next/navigation"
import { ReviewClient }   from "@/components/documents/review-client"

interface Props { params: Promise<{ id: string }> }

export default async function ReviewPage({ params }: Props) {
  const { id } = await params
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const [{ data: doc }, { data: integrations }] = await Promise.all([
    supabase
      .from("documents")
      .select(`
        *,
        document_line_items(*),
        document_audit_logs(id, action, actor_id, created_at, note)
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("integrations")
      .select("id, provider, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true),
  ])

  if (!doc) notFound()

  // Get public URL for file
  const { data: { publicUrl } } = supabase.storage
    .from("documents")
    .getPublicUrl(doc.file_path)

  return (
    <ReviewClient
      doc={doc}
      fileUrl={publicUrl}
      integrations={integrations ?? []}
      userRole={role}
    />
  )
}
