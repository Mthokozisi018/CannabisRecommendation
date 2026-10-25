import { notFound } from "next/navigation";
import { registrationLegalDocuments, REGISTRATION_NOTICE_VERSION, type RegistrationLegalSlug } from "@/lib/registration/legal";
export default async function LegalDocumentPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!Object.hasOwn(registrationLegalDocuments, document)) notFound();
  const doc = registrationLegalDocuments[document as RegistrationLegalSlug];
  return <main className="min-h-[100dvh] bg-white p-5 text-[#14251b]"><article className="mx-auto max-w-2xl pb-10"><p className="font-bold text-[#087c39]">GreenChoice</p><h1 className="mt-5 text-3xl font-black">{doc.title}</h1><p className="mt-2 text-sm">Version {REGISTRATION_NOTICE_VERSION}</p><p className="mt-4">If opened separately, return to your registration tab to continue.</p>{doc.sections.map(section => <section id={section.id} key={section.id} className="mt-8 scroll-mt-5"><h2 className="text-xl font-bold">{section.heading}</h2><p className="mt-3 leading-7">{section.content}</p></section>)}</article></main>;
}
