begin;

-- New temporary objects are AES-256-GCM envelopes created by the application.
-- Keep the existing JPEG type temporarily so cleanup can drain earlier uploads.
update storage.buckets
set file_size_limit = 6291520,
    allowed_mime_types = array['application/octet-stream', 'image/jpeg']::text[]
where id = 'registration-documents' and public = false;

commit;
