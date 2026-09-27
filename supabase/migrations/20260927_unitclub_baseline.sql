-- advisortool on UnitClub: every table, view and function it owned on DATA2.0, as they
-- stood on 2026-09-27, rebuilt from pg_dump by scripts/unitclub/build-baseline.py.
-- The migrations dated before this file describe DATA2.0's history and are not replayed here.

create extension if not exists vector with schema extensions;
create extension if not exists pgroonga with schema extensions;


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('assets',         'assets',         false, null,     null),
  ('content-media',  'content-media',  false, 10485760, array['image/png','image/jpeg','image/webp']),
  ('content-people', 'content-people', false, 5242880,  array['image/png','image/jpeg','image/webp']),
  ('insurance-docs', 'insurance-docs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

CREATE TABLE "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "error" "text",
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'succeeded'::"text", 'failed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."jobs" OWNER TO "postgres";

CREATE TABLE "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "kind" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "content_type" "text" NOT NULL,
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "name" "text" NOT NULL,
    "provenance" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assets_kind_check" CHECK (("kind" = ANY (ARRAY['image'::"text", 'video'::"text", 'audio'::"text", 'text'::"text", 'poster'::"text", 'render'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."assets" OWNER TO "postgres";

CREATE TABLE "public"."brand_kits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_asset_id" "uuid",
    "colors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "fonts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tone_of_voice" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."brand_kits" OWNER TO "postgres";

CREATE TABLE "public"."cost_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "module" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "quantity" numeric NOT NULL,
    "cost_thb" numeric(12,4) NOT NULL,
    "estimated" boolean DEFAULT false NOT NULL,
    "month_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."cost_entries" OWNER TO "postgres";

CREATE TABLE "public"."ins_ad_daily" (
    "date" "date" NOT NULL,
    "ad_id" "text" NOT NULL,
    "ad_name" "text",
    "adset_id" "text",
    "adset_name" "text",
    "campaign_id" "text",
    "campaign_name" "text",
    "spend" numeric(12,2) DEFAULT 0 NOT NULL,
    "impressions" integer DEFAULT 0 NOT NULL,
    "reach" integer DEFAULT 0 NOT NULL,
    "clicks" integer DEFAULT 0 NOT NULL,
    "link_clicks" integer DEFAULT 0 NOT NULL,
    "messaging_started" integer DEFAULT 0 NOT NULL,
    "actions" "jsonb",
    "currency" "text" DEFAULT 'THB'::"text" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "account_id" "text"
);

ALTER TABLE "public"."ins_ad_daily" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_ad_daily" IS 'Daily ad insights per ad, written by a Routine from the Marketing API. No personal data.';

COMMENT ON COLUMN "public"."ins_ad_daily"."account_id" IS 'บัญชีโฆษณาที่แถวนี้มาจาก (act_...) ใช้แยกแคมเปญชื่อซ้ำข้ามบัญชี';

CREATE TABLE "public"."ins_ad_products" (
    "ad_id" "text" NOT NULL,
    "product" "text" NOT NULL,
    "label" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ins_ad_products_product_check" CHECK (("product" = ANY (ARRAY['lifeprotect'::"text", 'ihealthy'::"text"])))
);

ALTER TABLE "public"."ins_ad_products" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_ad_products" IS 'จับคู่ ad_id ของ Facebook กับแบบประกัน สำหรับโฆษณาที่ชื่อไม่ได้บอกว่าเป็นแบบไหน';

CREATE TABLE "public"."ins_ai_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "small_model" "text",
    "large_model" "text",
    "monthly_budget_thb" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_budget_thb" numeric,
    CONSTRAINT "ins_ai_settings_content_budget_thb_check" CHECK (("content_budget_thb" >= (0)::numeric)),
    CONSTRAINT "ins_ai_settings_id_check" CHECK ("id")
);

ALTER TABLE "public"."ins_ai_settings" OWNER TO "postgres";

CREATE TABLE "public"."ins_alert_log" (
    "id" bigint NOT NULL,
    "kind" "text" NOT NULL,
    "detail" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_alert_log" OWNER TO "postgres";

CREATE SEQUENCE "public"."ins_alert_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."ins_alert_log_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."ins_alert_log_id_seq" OWNED BY "public"."ins_alert_log"."id";

CREATE TABLE "public"."ins_alert_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "line_user_id" "text",
    "label" "text",
    "leads_mode" "text" DEFAULT 'quote'::"text" NOT NULL,
    "monthly_cap" integer DEFAULT 250 NOT NULL,
    "pending_code" "text",
    "pending_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ins_alert_settings_id_check" CHECK ("id"),
    CONSTRAINT "ins_alert_settings_leads_mode_check" CHECK (("leads_mode" = ANY (ARRAY['off'::"text", 'quote'::"text", 'all'::"text"])))
);

ALTER TABLE "public"."ins_alert_settings" OWNER TO "postgres";

CREATE TABLE "public"."ins_api_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "prefix" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "quota_month" integer,
    "used_month" integer DEFAULT 0 NOT NULL,
    "period" "text" DEFAULT "to_char"(("now"() AT TIME ZONE 'utc'::"text"), 'YYYY-MM'::"text") NOT NULL,
    "last_used_at" timestamp with time zone,
    "disabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_api_clients" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_api_clients" IS 'กุญแจของระบบภายนอกที่เรียก API ของเรา เก็บเฉพาะค่าแฮช ไม่เก็บกุญแจจริง';

CREATE TABLE "public"."ins_api_keys" (
    "provider" "text" NOT NULL,
    "key_cipher" "bytea" NOT NULL,
    "tail" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL
);

ALTER TABLE "public"."ins_api_keys" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_api_keys" IS 'กุญแจสำหรับเรียก API ของระบบ เก็บเฉพาะค่าแฮช ไม่เก็บกุญแจจริง';

CREATE TABLE "public"."ins_channel_auth" (
    "key" "text" NOT NULL,
    "page_id" "text",
    "page_name" "text",
    "token_cipher" "bytea" NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "fields" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_sync_at" timestamp with time zone,
    "last_sync_ok_at" timestamp with time zone,
    "last_sync_error" "text"
);

ALTER TABLE "public"."ins_channel_auth" OWNER TO "postgres";

COMMENT ON COLUMN "public"."ins_channel_auth"."last_sync_at" IS 'บัญชีโฆษณา: ดึงตัวเลขครั้งล่าสุดเมื่อไร (สำเร็จหรือไม่ก็ตาม) — แถวของเพจเว้นว่าง';

COMMENT ON COLUMN "public"."ins_channel_auth"."last_sync_ok_at" IS 'บัญชีโฆษณา: ดึงสำเร็จครั้งล่าสุดเมื่อไร ใช้ตัดสินว่าข้อมูลค้าง';

COMMENT ON COLUMN "public"."ins_channel_auth"."last_sync_error" IS 'บัญชีโฆษณา: สาเหตุที่ดึงครั้งล่าสุดไม่สำเร็จ ว่างถ้าสำเร็จ';

CREATE TABLE "public"."ins_chat_events" (
    "event_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "channel" "text" DEFAULT 'line'::"text" NOT NULL
);

ALTER TABLE "public"."ins_chat_events" OWNER TO "postgres";

CREATE TABLE "public"."ins_chat_followups" (
    "channel" "text" NOT NULL,
    "user_hash" "text" NOT NULL,
    "psid_cipher" "bytea",
    "quoted_at" timestamp with time zone NOT NULL,
    "due_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone,
    "stage" smallint DEFAULT 1 NOT NULL,
    "page_id" "text"
);

ALTER TABLE "public"."ins_chat_followups" OWNER TO "postgres";

CREATE TABLE "public"."ins_chat_review_items" (
    "id" bigint NOT NULL,
    "review_id" bigint NOT NULL,
    "kind" "text" NOT NULL,
    "question" "text" NOT NULL,
    "evidence" "text",
    "answer" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "faq_id" "uuid",
    "decided_at" timestamp with time zone,
    CONSTRAINT "ins_chat_review_items_answer_check" CHECK (("length"("answer") <= 2000)),
    CONSTRAINT "ins_chat_review_items_evidence_check" CHECK (("length"("evidence") <= 400)),
    CONSTRAINT "ins_chat_review_items_kind_check" CHECK (("kind" = ANY (ARRAY['unanswered'::"text", 'wrong'::"text", 'dropoff'::"text", 'agent'::"text"]))),
    CONSTRAINT "ins_chat_review_items_question_check" CHECK (("length"("question") <= 200)),
    CONSTRAINT "ins_chat_review_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'used'::"text", 'skipped'::"text"])))
);

ALTER TABLE "public"."ins_chat_review_items" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_chat_review_items" IS 'A proposed note from a review: the question, a short quote as evidence, and the answer. used = copied into ins_faq (faq_id).';

CREATE SEQUENCE "public"."ins_chat_review_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."ins_chat_review_items_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."ins_chat_review_items_id_seq" OWNED BY "public"."ins_chat_review_items"."id";

CREATE TABLE "public"."ins_chat_reviews" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "since" timestamp with time zone NOT NULL,
    "until" timestamp with time zone NOT NULL,
    "conversations" integer DEFAULT 0 NOT NULL,
    "summary" "text" NOT NULL,
    "model" "text",
    "cost_thb" numeric DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."ins_chat_reviews" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_chat_reviews" IS 'One row per review of the transcripts between since and until. Kept 90 days, like the transcripts it quotes.';

CREATE SEQUENCE "public"."ins_chat_reviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."ins_chat_reviews_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."ins_chat_reviews_id_seq" OWNED BY "public"."ins_chat_reviews"."id";

CREATE TABLE "public"."ins_chat_sessions" (
    "user_hash" "text" NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_agent" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slots" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "channel" "text" DEFAULT 'line'::"text" NOT NULL,
    "alerted_at" timestamp with time zone,
    "muted_until" timestamp with time zone,
    "conversation_id" "uuid",
    "handed_over_at" timestamp with time zone
);

ALTER TABLE "public"."ins_chat_sessions" OWNER TO "postgres";

COMMENT ON COLUMN "public"."ins_chat_sessions"."muted_until" IS 'While this is in the future the bot stays out of the thread: an agent has answered by hand.';

COMMENT ON COLUMN "public"."ins_chat_sessions"."conversation_id" IS 'The conversation this live session belongs to; a stale session starts a new one.';

COMMENT ON COLUMN "public"."ins_chat_sessions"."handed_over_at" IS 'When the application form was handed to this customer. The bot answers nothing in the thread after it: what follows a form is an agent. Unlike the session itself this does not go stale — clear the column to give the thread back to the bot.';

CREATE TABLE "public"."ins_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_href" "text" NOT NULL,
    "format" "text" NOT NULL,
    "angle" "text",
    "length" "text",
    "output" "jsonb" NOT NULL,
    "flags" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rate_version" "text",
    "model" "text",
    "cost_thb" numeric DEFAULT 0 NOT NULL,
    "starred" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "hook_template_id" "uuid",
    "fb_page_id" "text",
    "fb_post_id" "text",
    "publish_state" "text",
    "publish_at" timestamp with time zone,
    "publish_error" "text",
    CONSTRAINT "ins_content_format_check" CHECK (("format" = ANY (ARRAY['post'::"text", 'script'::"text", 'ad'::"text"]))),
    CONSTRAINT "ins_content_publish_state_check" CHECK (("publish_state" = ANY (ARRAY['posting'::"text", 'scheduled'::"text", 'published'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "ins_content_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'used'::"text", 'trashed'::"text"])))
);

ALTER TABLE "public"."ins_content" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_content" IS 'โพสต์และสคริปต์ที่หน้า /content สร้าง พร้อมผลตรวจตัวเลข/คำ';

CREATE TABLE "public"."ins_content_words" (
    "word" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "fix" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ins_content_words_kind_check" CHECK (("kind" = ANY (ARRAY['banned'::"text", 'misspelling'::"text"])))
);

ALTER TABLE "public"."ins_content_words" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_content_words" IS 'คำที่ตัวตรวจโพสต์เตือน: คำโฆษณาต้องห้าม และคำที่มักสะกดผิดพร้อมคำที่ถูก';

CREATE TABLE "public"."ins_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel" "text" DEFAULT 'facebook'::"text" NOT NULL,
    "page_id" "text",
    "user_hash" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_event_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product" "text",
    "source" "text",
    "ad_id" "text",
    "ref" "text",
    "referral" "jsonb",
    "entry_payload" "text",
    "priced_at" timestamp with time zone,
    "form_sent_at" timestamp with time zone,
    "form_done_at" timestamp with time zone,
    "agent_replied_at" timestamp with time zone,
    "stalled_at" timestamp with time zone,
    "handover_at" timestamp with time zone,
    "messages" integer DEFAULT 0 NOT NULL,
    "model_calls" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."ins_conversations" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_conversations" IS 'One row per bot conversation on the Page: where it came from and how far it went. user_hash is nulled after 90 days.';

CREATE TABLE "public"."ins_cron_secret" (
    "name" "text" NOT NULL,
    "secret" "text" NOT NULL
);

ALTER TABLE "public"."ins_cron_secret" OWNER TO "postgres";

CREATE TABLE "public"."ins_doc_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doc_id" "uuid" NOT NULL,
    "page" integer,
    "ordinal" integer DEFAULT 0 NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "extensions"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_doc_chunks" OWNER TO "postgres";

CREATE TABLE "public"."ins_events" (
    "id" bigint NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" NOT NULL,
    "product" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

ALTER TABLE "public"."ins_events" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_events" IS 'What happened in a conversation: kinds and figures only, never the customer''s words.';

CREATE SEQUENCE "public"."ins_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."ins_events_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."ins_events_id_seq" OWNED BY "public"."ins_events"."id";

CREATE TABLE "public"."ins_faq" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "embedding" "extensions"."vector"(1536),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_faq" OWNER TO "postgres";

CREATE TABLE "public"."ins_hook_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "template" "text" NOT NULL,
    "example_hook" "text",
    "source_content_id" "uuid",
    "use_count" integer DEFAULT 0 NOT NULL,
    "seed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ins_hook_templates_category_check" CHECK (("category" = ANY (ARRAY['SWAP'::"text", 'BUILD'::"text", 'CLAIM'::"text", 'LIST'::"text", 'CONTRARIAN'::"text"]))),
    CONSTRAINT "ins_hook_templates_template_check" CHECK ((("char_length"("btrim"("template")) >= 4) AND ("char_length"("btrim"("template")) <= 200))),
    CONSTRAINT "ins_hook_templates_use_count_check" CHECK (("use_count" >= 0))
);

ALTER TABLE "public"."ins_hook_templates" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_hook_templates" IS 'สูตรประโยคเปิด (hook) มีช่อง [ ] ให้เติม — 30 สูตรตั้งต้นจาก Maryjane และสูตรที่ถอดจากโพสต์ที่ใช้จริง';

CREATE TABLE "public"."ins_knowledge_docs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "plan_code" "text",
    "storage_path" "text" NOT NULL,
    "bytes" bigint DEFAULT 0 NOT NULL,
    "page_count" integer,
    "raw_text" "text",
    "status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "error" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_knowledge_docs" OWNER TO "postgres";

CREATE TABLE "public"."ins_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "channel" "text" DEFAULT 'facebook'::"text" NOT NULL,
    "page_id" "text",
    "user_hash" "text",
    "psid_cipher" "bytea",
    "stage" "text" DEFAULT 'interested'::"text" NOT NULL,
    "product" "text",
    "last_quote" "jsonb",
    "ad_id" "text",
    "ref" "text",
    "form_ref" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone
);

ALTER TABLE "public"."ins_leads" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_leads" IS 'A customer who asked to apply or to talk to a person. psid_cipher is pgp_sym_encrypt''d and nulled 180 days after the lead closes.';

CREATE TABLE "public"."ins_login_attempts" (
    "id" bigint NOT NULL,
    "ip" "text" NOT NULL,
    "ok" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_login_attempts" OWNER TO "postgres";

CREATE SEQUENCE "public"."ins_login_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."ins_login_attempts_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."ins_login_attempts_id_seq" OWNED BY "public"."ins_login_attempts"."id";

CREATE TABLE "public"."ins_model_prefs" (
    "model_id" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_model_prefs" OWNER TO "postgres";

CREATE TABLE "public"."ins_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "photos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "consented_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ins_people_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 40)))
);

ALTER TABLE "public"."ins_people" OWNER TO "postgres";

CREATE TABLE "public"."ins_plan_rule_overrides" (
    "plan_code" "text" NOT NULL,
    "rules" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text"
);

ALTER TABLE "public"."ins_plan_rule_overrides" OWNER TO "postgres";

CREATE TABLE "public"."ins_plan_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "input" "jsonb" NOT NULL,
    "result" "jsonb" NOT NULL
);

ALTER TABLE "public"."ins_plan_runs" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_plan_runs" IS 'Plans built on /plan: input = what the customer typed, result = PlanResult shown. Anonymous; kept 30 days.';

CREATE TABLE "public"."ins_prompt_overrides" (
    "key" "text" NOT NULL,
    "text" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_prompt_overrides" OWNER TO "postgres";

CREATE TABLE "public"."ins_route_shadow" (
    "id" bigint NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product" "text" NOT NULL,
    "model_intent" "text" NOT NULL,
    "final_intent" "text" NOT NULL,
    "jev_intent" "text" NOT NULL,
    "jev_confidence" numeric(4,3) NOT NULL,
    "agrees_model" boolean NOT NULL,
    "agrees_final" boolean NOT NULL
);

ALTER TABLE "public"."ins_route_shadow" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_route_shadow" IS 'Jev vs the chat model on every routed turn while the judge runs in shadow. Kinds and numbers only, never the customer''s words.';

ALTER TABLE "public"."ins_route_shadow" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ins_route_shadow_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE "public"."ins_rule_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_code" "text" NOT NULL,
    "before" "jsonb",
    "after" "jsonb",
    "changed_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_rule_audit" OWNER TO "postgres";

CREATE TABLE "public"."ins_transcripts" (
    "id" bigint NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "channel" "text" NOT NULL,
    "page_id" "text",
    "user_hash" "text" NOT NULL,
    "conversation_id" "uuid",
    "role" "text" NOT NULL,
    "text" "text" NOT NULL,
    "product" "text",
    CONSTRAINT "ins_transcripts_channel_check" CHECK (("channel" = ANY (ARRAY['facebook'::"text", 'line'::"text"]))),
    CONSTRAINT "ins_transcripts_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'bot'::"text", 'agent'::"text"]))),
    CONSTRAINT "ins_transcripts_text_check" CHECK (("length"("text") <= 2000))
);

ALTER TABLE "public"."ins_transcripts" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_transcripts" IS 'Chat turns, scrubbed of contact details: role = customer | bot | agent. Kept 90 days, then deleted by the daily review.';

CREATE SEQUENCE "public"."ins_transcripts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."ins_transcripts_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."ins_transcripts_id_seq" OWNED BY "public"."ins_transcripts"."id";

CREATE TABLE "public"."ins_unanswered" (
    "id" bigint NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product" "text",
    "intent" "text" NOT NULL,
    "route" "text" NOT NULL,
    "question" "text" NOT NULL,
    "answered_at" timestamp with time zone
);

ALTER TABLE "public"."ins_unanswered" OWNER TO "postgres";

COMMENT ON TABLE "public"."ins_unanswered" IS 'Questions the bot had no written answer for, as the model''s stand-alone rewrite. Unlinked to anyone; kept 30 days.';

COMMENT ON COLUMN "public"."ins_unanswered"."answered_at" IS 'When the owner marked this question answered on /admin/crm. Empty = still waiting; the CRM tab and the /admin alert count only these.';

CREATE SEQUENCE "public"."ins_unanswered_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."ins_unanswered_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."ins_unanswered_id_seq" OWNED BY "public"."ins_unanswered"."id";

CREATE TABLE "public"."ins_usage_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model" "text" NOT NULL,
    "task" "text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "cost_thb" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ins_usage_ledger" OWNER TO "postgres";

CREATE TABLE "public"."job_step_cache" (
    "hash" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."job_step_cache" OWNER TO "postgres";

CREATE TABLE "public"."model_configs" (
    "id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "model_name" "text" NOT NULL,
    "price" "jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "model_configs_kind_check" CHECK (("kind" = ANY (ARRAY['text'::"text", 'image'::"text"]))),
    CONSTRAINT "model_configs_provider_check" CHECK (("provider" = ANY (ARRAY['anthropic'::"text", 'openai'::"text", 'google'::"text", 'xai'::"text", 'zai'::"text"])))
);

ALTER TABLE "public"."model_configs" OWNER TO "postgres";

CREATE TABLE "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "module" "text" DEFAULT 'general'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."projects" OWNER TO "postgres";

CREATE TABLE "public"."settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."settings" OWNER TO "postgres";

ALTER TABLE ONLY "public"."ins_alert_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ins_alert_log_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."ins_chat_review_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ins_chat_review_items_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."ins_chat_reviews" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ins_chat_reviews_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."ins_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ins_events_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."ins_login_attempts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ins_login_attempts_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."ins_transcripts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ins_transcripts_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."ins_unanswered" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ins_unanswered_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_storage_path_key" UNIQUE ("storage_path");

ALTER TABLE ONLY "public"."brand_kits"
    ADD CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_ad_daily"
    ADD CONSTRAINT "ins_ad_daily_pkey" PRIMARY KEY ("date", "ad_id");

ALTER TABLE ONLY "public"."ins_ad_products"
    ADD CONSTRAINT "ins_ad_products_pkey" PRIMARY KEY ("ad_id");

ALTER TABLE ONLY "public"."ins_ai_settings"
    ADD CONSTRAINT "ins_ai_settings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_alert_log"
    ADD CONSTRAINT "ins_alert_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_alert_settings"
    ADD CONSTRAINT "ins_alert_settings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_api_clients"
    ADD CONSTRAINT "ins_api_clients_key_hash_key" UNIQUE ("key_hash");

ALTER TABLE ONLY "public"."ins_api_clients"
    ADD CONSTRAINT "ins_api_clients_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_api_keys"
    ADD CONSTRAINT "ins_api_keys_pkey" PRIMARY KEY ("provider");

ALTER TABLE ONLY "public"."ins_channel_auth"
    ADD CONSTRAINT "ins_channel_auth_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."ins_chat_events"
    ADD CONSTRAINT "ins_chat_events_pkey" PRIMARY KEY ("channel", "event_id");

ALTER TABLE ONLY "public"."ins_chat_followups"
    ADD CONSTRAINT "ins_chat_followups_pkey" PRIMARY KEY ("channel", "user_hash");

ALTER TABLE ONLY "public"."ins_chat_review_items"
    ADD CONSTRAINT "ins_chat_review_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_chat_reviews"
    ADD CONSTRAINT "ins_chat_reviews_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_chat_sessions"
    ADD CONSTRAINT "ins_chat_sessions_pkey" PRIMARY KEY ("channel", "user_hash");

ALTER TABLE ONLY "public"."ins_content"
    ADD CONSTRAINT "ins_content_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_content_words"
    ADD CONSTRAINT "ins_content_words_pkey" PRIMARY KEY ("word");

ALTER TABLE ONLY "public"."ins_conversations"
    ADD CONSTRAINT "ins_conversations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_cron_secret"
    ADD CONSTRAINT "ins_cron_secret_pkey" PRIMARY KEY ("name");

ALTER TABLE ONLY "public"."ins_doc_chunks"
    ADD CONSTRAINT "ins_doc_chunks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_events"
    ADD CONSTRAINT "ins_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_faq"
    ADD CONSTRAINT "ins_faq_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_hook_templates"
    ADD CONSTRAINT "ins_hook_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_knowledge_docs"
    ADD CONSTRAINT "ins_knowledge_docs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_leads"
    ADD CONSTRAINT "ins_leads_conversation_id_key" UNIQUE ("conversation_id");

ALTER TABLE ONLY "public"."ins_leads"
    ADD CONSTRAINT "ins_leads_form_ref_key" UNIQUE ("form_ref");

ALTER TABLE ONLY "public"."ins_leads"
    ADD CONSTRAINT "ins_leads_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_login_attempts"
    ADD CONSTRAINT "ins_login_attempts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_model_prefs"
    ADD CONSTRAINT "ins_model_prefs_pkey" PRIMARY KEY ("model_id");

ALTER TABLE ONLY "public"."ins_people"
    ADD CONSTRAINT "ins_people_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_plan_rule_overrides"
    ADD CONSTRAINT "ins_plan_rule_overrides_pkey" PRIMARY KEY ("plan_code");

ALTER TABLE ONLY "public"."ins_plan_runs"
    ADD CONSTRAINT "ins_plan_runs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_prompt_overrides"
    ADD CONSTRAINT "ins_prompt_overrides_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."ins_route_shadow"
    ADD CONSTRAINT "ins_route_shadow_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_rule_audit"
    ADD CONSTRAINT "ins_rule_audit_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_transcripts"
    ADD CONSTRAINT "ins_transcripts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_unanswered"
    ADD CONSTRAINT "ins_unanswered_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ins_usage_ledger"
    ADD CONSTRAINT "ins_usage_ledger_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."job_step_cache"
    ADD CONSTRAINT "job_step_cache_pkey" PRIMARY KEY ("hash");

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."model_configs"
    ADD CONSTRAINT "model_configs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("key");

CREATE INDEX "assets_project_created" ON "public"."assets" USING "btree" ("project_id", "created_at" DESC);

CREATE INDEX "cost_entries_month" ON "public"."cost_entries" USING "btree" ("month_key", "created_at" DESC);

CREATE INDEX "ins_alert_log_sent_at" ON "public"."ins_alert_log" USING "btree" ("sent_at" DESC);

CREATE INDEX "ins_chat_followups_due" ON "public"."ins_chat_followups" USING "btree" ("due_at") WHERE ("sent_at" IS NULL);

CREATE INDEX "ins_chat_review_items_review_idx" ON "public"."ins_chat_review_items" USING "btree" ("review_id");

CREATE INDEX "ins_chat_reviews_created_idx" ON "public"."ins_chat_reviews" USING "btree" ("created_at" DESC);

CREATE INDEX "ins_content_created_at" ON "public"."ins_content" USING "btree" ("created_at" DESC);

CREATE INDEX "ins_content_publish_at" ON "public"."ins_content" USING "btree" ("publish_at") WHERE ("publish_state" = ANY (ARRAY['scheduled'::"text", 'published'::"text"]));

CREATE INDEX "ins_content_status_created_at" ON "public"."ins_content" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "ins_conversations_ad_idx" ON "public"."ins_conversations" USING "btree" ("ad_id") WHERE ("ad_id" IS NOT NULL);

CREATE INDEX "ins_conversations_started_idx" ON "public"."ins_conversations" USING "btree" ("started_at");

CREATE INDEX "ins_conversations_user_idx" ON "public"."ins_conversations" USING "btree" ("channel", "user_hash") WHERE ("user_hash" IS NOT NULL);

CREATE INDEX "ins_doc_chunks_content_idx" ON "public"."ins_doc_chunks" USING "pgroonga" ("content");

CREATE INDEX "ins_doc_chunks_doc_idx" ON "public"."ins_doc_chunks" USING "btree" ("doc_id");

CREATE INDEX "ins_doc_chunks_embedding_idx" ON "public"."ins_doc_chunks" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops");

CREATE INDEX "ins_events_conv_idx" ON "public"."ins_events" USING "btree" ("conversation_id", "at");

CREATE INDEX "ins_events_kind_idx" ON "public"."ins_events" USING "btree" ("kind", "at");

CREATE INDEX "ins_faq_embedding_idx" ON "public"."ins_faq" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops");

CREATE UNIQUE INDEX "ins_hook_templates_template_key" ON "public"."ins_hook_templates" USING "btree" ("lower"("btrim"("template")));

CREATE INDEX "ins_knowledge_docs_plan_idx" ON "public"."ins_knowledge_docs" USING "btree" ("plan_code");

CREATE INDEX "ins_leads_stage_idx" ON "public"."ins_leads" USING "btree" ("stage", "updated_at");

CREATE INDEX "ins_line_events_created_at_idx" ON "public"."ins_chat_events" USING "btree" ("created_at");

CREATE INDEX "ins_line_sessions_updated_idx" ON "public"."ins_chat_sessions" USING "btree" ("updated_at");

CREATE INDEX "ins_login_attempts_ip_idx" ON "public"."ins_login_attempts" USING "btree" ("ip", "created_at" DESC);

CREATE INDEX "ins_plan_runs_created_idx" ON "public"."ins_plan_runs" USING "btree" ("created_at" DESC);

CREATE INDEX "ins_rule_audit_plan_idx" ON "public"."ins_rule_audit" USING "btree" ("plan_code", "created_at" DESC);

CREATE INDEX "ins_transcripts_at_idx" ON "public"."ins_transcripts" USING "btree" ("at");

CREATE INDEX "ins_transcripts_thread_idx" ON "public"."ins_transcripts" USING "btree" ("channel", "user_hash", "at");

CREATE INDEX "ins_unanswered_open_idx" ON "public"."ins_unanswered" USING "btree" ("at" DESC) WHERE ("answered_at" IS NULL);

CREATE INDEX "ins_usage_ledger_created_at_idx" ON "public"."ins_usage_ledger" USING "btree" ("created_at");

CREATE INDEX "ins_usage_ledger_created_idx" ON "public"."ins_usage_ledger" USING "btree" ("created_at" DESC);

CREATE INDEX "jobs_project_created" ON "public"."jobs" USING "btree" ("project_id", "created_at" DESC);

CREATE INDEX "jobs_status_created" ON "public"."jobs" USING "btree" ("status", "created_at");

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."brand_kits"
    ADD CONSTRAINT "brand_kits_logo_asset_id_fkey" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ins_chat_review_items"
    ADD CONSTRAINT "ins_chat_review_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."ins_chat_reviews"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ins_chat_sessions"
    ADD CONSTRAINT "ins_chat_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ins_conversations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ins_content"
    ADD CONSTRAINT "ins_content_hook_template_id_fkey" FOREIGN KEY ("hook_template_id") REFERENCES "public"."ins_hook_templates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ins_doc_chunks"
    ADD CONSTRAINT "ins_doc_chunks_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "public"."ins_knowledge_docs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ins_events"
    ADD CONSTRAINT "ins_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ins_conversations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ins_hook_templates"
    ADD CONSTRAINT "ins_hook_templates_source_content_id_fkey" FOREIGN KEY ("source_content_id") REFERENCES "public"."ins_content"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ins_leads"
    ADD CONSTRAINT "ins_leads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ins_conversations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;

ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."brand_kits" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cost_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_ad_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_ad_products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_ai_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_alert_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_alert_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_api_clients" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_api_keys" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_channel_auth" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_chat_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_chat_followups" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_chat_review_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_chat_reviews" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_chat_sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_content" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_content_words" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_conversations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_cron_secret" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_doc_chunks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_faq" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_hook_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_knowledge_docs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_leads" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_login_attempts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_model_prefs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_people" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_plan_rule_overrides" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_plan_runs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_prompt_overrides" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_route_shadow" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_rule_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_transcripts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_unanswered" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ins_usage_ledger" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."job_step_cache" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."model_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."jobs" TO "service_role";

GRANT ALL ON TABLE "public"."assets" TO "service_role";

GRANT ALL ON TABLE "public"."brand_kits" TO "service_role";

GRANT ALL ON TABLE "public"."cost_entries" TO "service_role";

GRANT ALL ON TABLE "public"."ins_ad_daily" TO "service_role";

GRANT ALL ON TABLE "public"."ins_ad_products" TO "service_role";

GRANT ALL ON TABLE "public"."ins_ai_settings" TO "service_role";

GRANT ALL ON TABLE "public"."ins_alert_log" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ins_alert_log_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_alert_settings" TO "service_role";

GRANT ALL ON TABLE "public"."ins_api_clients" TO "service_role";

GRANT ALL ON TABLE "public"."ins_api_keys" TO "service_role";

GRANT ALL ON TABLE "public"."ins_channel_auth" TO "service_role";

GRANT ALL ON TABLE "public"."ins_chat_events" TO "service_role";

GRANT ALL ON TABLE "public"."ins_chat_followups" TO "service_role";

GRANT ALL ON TABLE "public"."ins_chat_review_items" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ins_chat_review_items_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_chat_reviews" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ins_chat_reviews_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_chat_sessions" TO "service_role";

GRANT ALL ON TABLE "public"."ins_content" TO "service_role";

GRANT ALL ON TABLE "public"."ins_content_words" TO "service_role";

GRANT ALL ON TABLE "public"."ins_conversations" TO "service_role";

GRANT ALL ON TABLE "public"."ins_cron_secret" TO "service_role";

GRANT ALL ON TABLE "public"."ins_doc_chunks" TO "service_role";

GRANT ALL ON TABLE "public"."ins_events" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ins_events_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_faq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_hook_templates" TO "service_role";

GRANT ALL ON TABLE "public"."ins_knowledge_docs" TO "service_role";

GRANT ALL ON TABLE "public"."ins_leads" TO "service_role";

GRANT ALL ON TABLE "public"."ins_login_attempts" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ins_login_attempts_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_model_prefs" TO "service_role";

GRANT ALL ON TABLE "public"."ins_people" TO "service_role";

GRANT ALL ON TABLE "public"."ins_plan_rule_overrides" TO "service_role";

GRANT ALL ON TABLE "public"."ins_plan_runs" TO "service_role";

GRANT ALL ON TABLE "public"."ins_prompt_overrides" TO "service_role";

GRANT ALL ON TABLE "public"."ins_route_shadow" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ins_route_shadow_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_rule_audit" TO "service_role";

GRANT ALL ON TABLE "public"."ins_transcripts" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ins_transcripts_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_unanswered" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ins_unanswered_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ins_usage_ledger" TO "service_role";

GRANT ALL ON TABLE "public"."job_step_cache" TO "service_role";

GRANT ALL ON TABLE "public"."model_configs" TO "service_role";

GRANT ALL ON TABLE "public"."projects" TO "service_role";

GRANT ALL ON TABLE "public"."settings" TO "service_role";

CREATE FUNCTION "public"."claim_next_job"("p_worker" "text") RETURNS SETOF "public"."jobs"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  update jobs
     set status = 'running', locked_at = now(), locked_by = p_worker,
         attempts = attempts + 1, updated_at = now()
   where id = (
     select id from jobs where status = 'queued'
      order by created_at
      limit 1
      for update skip locked
   )
  returning *;
$$;

ALTER FUNCTION "public"."claim_next_job"("p_worker" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."cost_spent_in_month"("p_month" "text") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sum(cost_thb), 0) from cost_entries where month_key = p_month
$$;

ALTER FUNCTION "public"."cost_spent_in_month"("p_month" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_api_client_use"("p_hash" "text") RETURNS TABLE("ok" boolean, "reason" "text", "client_name" "text", "remaining" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  k public.ins_api_clients%rowtype;
  this_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  select * into k from public.ins_api_clients where key_hash = p_hash for update;

  if not found then
    return query select false, 'unknown_key', null::text, null::integer;
    return;
  end if;

  if k.disabled then
    return query select false, 'disabled', k.name, 0;
    return;
  end if;

  if k.period <> this_period then
    k.used_month := 0;
    k.period := this_period;
  end if;

  if k.quota_month is not null and k.used_month >= k.quota_month then
    return query select false, 'quota_exhausted', k.name, 0;
    return;
  end if;

  update public.ins_api_clients
     set used_month = k.used_month + 1,
         period = this_period,
         last_used_at = now()
   where id = k.id;

  return query select
    true,
    null::text,
    k.name,
    case when k.quota_month is null then null::integer else k.quota_month - k.used_month - 1 end;
end;
$$;

ALTER FUNCTION "public"."ins_api_client_use"("p_hash" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_arm_followup"("p_channel" "text", "p_user_hash" "text", "p_psid" "text", "p_due_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_passphrase" "text", "p_page_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  insert into public.ins_chat_followups
    (channel, user_hash, psid_cipher, page_id, quoted_at, due_at, expires_at, sent_at)
  values (p_channel, p_user_hash, extensions.pgp_sym_encrypt(p_psid, p_passphrase), p_page_id,
          now(), p_due_at, p_expires_at, null)
  on conflict (channel, user_hash) do update
    set psid_cipher = excluded.psid_cipher,
        page_id = excluded.page_id,
        quoted_at = excluded.quoted_at,
        due_at = excluded.due_at,
        expires_at = excluded.expires_at,
        sent_at = null
    where public.ins_chat_followups.expires_at <= now();
$$;

ALTER FUNCTION "public"."ins_arm_followup"("p_channel" "text", "p_user_hash" "text", "p_psid" "text", "p_due_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_passphrase" "text", "p_page_id" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_attribute"("p_conversation" "uuid", "p_source" "text", "p_ad_id" "text", "p_ref" "text", "p_referral" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  update public.ins_conversations set
    source        = case when ad_id is null and p_ad_id is not null then p_source else coalesce(source, p_source) end,
    ad_id         = coalesce(ad_id, p_ad_id),
    ref           = coalesce(ref, p_ref),
    referral      = coalesce(referral, p_referral),
    last_event_at = now()
  where id = p_conversation;
  insert into public.ins_events (conversation_id, kind, data)
  values (p_conversation, 'referral', jsonb_strip_nulls(jsonb_build_object('source', p_source, 'ad_id', p_ad_id, 'ref', p_ref)));
end $$;

ALTER FUNCTION "public"."ins_attribute"("p_conversation" "uuid", "p_source" "text", "p_ad_id" "text", "p_ref" "text", "p_referral" "jsonb") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_claim_followups"("p_channel" "text", "p_passphrase" "text") RETURNS TABLE("user_hash" "text", "psid" "text", "page_id" "text", "stage" smallint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  with due as (
    select f.user_hash as uh,
           extensions.pgp_sym_decrypt(f.psid_cipher, p_passphrase) as id,
           f.page_id as pg,
           f.stage as st,
           public.ins_followup_second_due(f.quoted_at, f.expires_at) as next_due
      from public.ins_chat_followups f
      join public.ins_chat_sessions s
        on s.channel = f.channel and s.user_hash = f.user_hash
     where f.channel = p_channel
       and f.sent_at is null
       and f.psid_cipher is not null
       and f.due_at <= now()
       and f.expires_at > now()
       and s.updated_at <= f.quoted_at
       and (s.muted_until is null or s.muted_until < now())
  ), advanced as (
    update public.ins_chat_followups f
       set stage = 2, due_at = d.next_due
      from due d
     where f.channel = p_channel and f.user_hash = d.uh
       and d.st = 1 and d.next_due is not null
    returning f.user_hash
  ), finished as (
    update public.ins_chat_followups f
       set sent_at = now(), psid_cipher = null
      from due d
     where f.channel = p_channel and f.user_hash = d.uh
       and (d.st >= 2 or d.next_due is null)
    returning f.user_hash
  )
  select d.uh, d.id, d.pg, d.st from due d;
$$;

ALTER FUNCTION "public"."ins_claim_followups"("p_channel" "text", "p_passphrase" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_clear_channel_auth"("p_key" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.ins_channel_auth where key = p_key;
$$;

ALTER FUNCTION "public"."ins_clear_channel_auth"("p_key" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_drop_followup"("p_channel" "text", "p_user_hash" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.ins_chat_followups
   where channel = p_channel and user_hash = p_user_hash;
$$;

ALTER FUNCTION "public"."ins_drop_followup"("p_channel" "text", "p_user_hash" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_followup_second_due"("p_quoted" timestamp with time zone, "p_expires" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  with wall as (
    select (p_expires - interval '1 hour') at time zone 'Asia/Bangkok' as t
  ), daytime as (
    select case
      when t::time > time '20:00' then date_trunc('day', t) + interval '20 hours'
      when t::time < time '09:00' then date_trunc('day', t) - interval '1 day' + interval '20 hours'
      else t
    end as t from wall
  )
  select case when (t at time zone 'Asia/Bangkok') > p_quoted + interval '1 hour'
              then t at time zone 'Asia/Bangkok' end
  from daytime;
$$;

ALTER FUNCTION "public"."ins_followup_second_due"("p_quoted" timestamp with time zone, "p_expires" timestamp with time zone) OWNER TO "postgres";

CREATE FUNCTION "public"."ins_get_api_keys"("p_passphrase" "text") RETURNS TABLE("provider" "text", "api_key" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select k.provider, extensions.pgp_sym_decrypt(k.key_cipher, p_passphrase)
  from public.ins_api_keys k;
$$;

ALTER FUNCTION "public"."ins_get_api_keys"("p_passphrase" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_get_channel_auth"("p_key" "text", "p_passphrase" "text") RETURNS TABLE("key" "text", "page_id" "text", "page_name" "text", "token" "text", "scopes" "text"[], "fields" "text"[], "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select a.key, a.page_id, a.page_name,
         extensions.pgp_sym_decrypt(a.token_cipher, p_passphrase),
         a.scopes, a.fields, a.updated_at
  from public.ins_channel_auth a
  where a.key = p_key;
$$;

ALTER FUNCTION "public"."ins_get_channel_auth"("p_key" "text", "p_passphrase" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_get_lead_psid"("p_lead" "uuid", "p_passphrase" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select extensions.pgp_sym_decrypt(l.psid_cipher, p_passphrase) from public.ins_leads l where l.id = p_lead;
$$;

ALTER FUNCTION "public"."ins_get_lead_psid"("p_lead" "uuid", "p_passphrase" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_month_spend"("p_since" timestamp with time zone) RETURNS TABLE("model" "text", "task" "text", "calls" bigint, "cost_thb" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select l.model, l.task, count(*) as calls, coalesce(sum(l.cost_thb), 0) as cost_thb
  from public.ins_usage_ledger l
  where l.created_at >= p_since
  group by l.model, l.task
$$;

ALTER FUNCTION "public"."ins_month_spend"("p_since" timestamp with time zone) OWNER TO "postgres";

CREATE FUNCTION "public"."ins_open_conversation"("p_channel" "text", "p_page_id" "text", "p_user_hash" "text", "p_source" "text", "p_ad_id" "text", "p_ref" "text", "p_referral" "jsonb", "p_entry_payload" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare v_id uuid;
begin
  insert into public.ins_conversations (channel, page_id, user_hash, source, ad_id, ref, referral, entry_payload)
  values (p_channel, p_page_id, p_user_hash, coalesce(p_source, 'organic'), p_ad_id, p_ref, p_referral, p_entry_payload)
  returning id into v_id;
  insert into public.ins_events (conversation_id, kind, data)
  values (v_id, 'started', jsonb_strip_nulls(jsonb_build_object('source', coalesce(p_source, 'organic'), 'ad_id', p_ad_id, 'ref', p_ref)));
  return v_id;
end $$;

ALTER FUNCTION "public"."ins_open_conversation"("p_channel" "text", "p_page_id" "text", "p_user_hash" "text", "p_source" "text", "p_ad_id" "text", "p_ref" "text", "p_referral" "jsonb", "p_entry_payload" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_open_lead"("p_conversation" "uuid", "p_psid" "text", "p_passphrase" "text", "p_stage" "text", "p_product" "text", "p_form_ref" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare v_id uuid; v_quote jsonb;
begin
  select data into v_quote from public.ins_events
   where conversation_id = p_conversation and kind = 'quoted'
   order by at desc limit 1;

  insert into public.ins_leads as l (conversation_id, channel, page_id, user_hash, psid_cipher, stage, product, last_quote, ad_id, ref, form_ref)
  select c.id, c.channel, c.page_id, c.user_hash, extensions.pgp_sym_encrypt(p_psid, p_passphrase),
         coalesce(p_stage, 'interested'), coalesce(p_product, c.product), v_quote, c.ad_id, c.ref, p_form_ref
  from public.ins_conversations c where c.id = p_conversation
  on conflict (conversation_id) do update set
    stage = case
      when excluded.stage = 'form_done' then 'form_done'
      when excluded.stage = 'form_sent' and l.stage = 'interested' then 'form_sent'
      else l.stage end,
    last_quote = coalesce(excluded.last_quote, l.last_quote),
    form_ref   = coalesce(l.form_ref, excluded.form_ref),
    updated_at = now()
  returning l.id into v_id;
  return v_id;
end $$;

ALTER FUNCTION "public"."ins_open_lead"("p_conversation" "uuid", "p_psid" "text", "p_passphrase" "text", "p_stage" "text", "p_product" "text", "p_form_ref" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_prune"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  delete from ins_chat_sessions
   where updated_at < now() - interval '24 hours'
     and (muted_until is null or muted_until < now());
  delete from ins_chat_events where created_at < now() - interval '7 days';
  update ins_conversations set user_hash = null
   where user_hash is not null and last_event_at < now() - interval '90 days';
  delete from ins_events where at < now() - interval '13 months';
  delete from ins_unanswered where at < now() - interval '30 days';
  update ins_leads set psid_cipher = null
   where psid_cipher is not null and closed_at is not null and closed_at < now() - interval '180 days';
$$;

ALTER FUNCTION "public"."ins_prune"() OWNER TO "postgres";

CREATE FUNCTION "public"."ins_record"("p_conversation" "uuid", "p_events" "jsonb", "p_product" "text" DEFAULT NULL::"text", "p_unanswered" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare kinds text[];
begin
  insert into public.ins_events (conversation_id, kind, product, data)
  select p_conversation, e->>'kind', p_product, coalesce(e->'data', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
  where e->>'kind' is not null;

  select coalesce(array_agg(e->>'kind'), '{}'::text[]) into kinds
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e;

  update public.ins_conversations set
    last_event_at    = now(),
    product          = coalesce(p_product, product),
    messages         = messages + (select count(*)::int from unnest(kinds) k where k = 'message'),
    model_calls      = model_calls + (select count(*)::int from unnest(kinds) k where k in ('routed', 'plan_info', 'small_talk')),
    priced_at        = coalesce(priced_at,        case when 'quoted'        = any(kinds) then now() end),
    form_sent_at     = coalesce(form_sent_at,     case when 'form_sent'     = any(kinds) then now() end),
    form_done_at     = coalesce(form_done_at,     case when 'form_done'     = any(kinds) then now() end),
    agent_replied_at = coalesce(agent_replied_at, case when 'agent_replied' = any(kinds) then now() end),
    stalled_at       = coalesce(stalled_at,       case when 'stalled'       = any(kinds) then now() end),
    handover_at      = coalesce(handover_at,      case when 'handover'      = any(kinds) then now() end)
  where id = p_conversation;

  insert into public.ins_unanswered (product, intent, route, question)
  select p_product, coalesce(u->>'intent', 'other'), coalesce(u->>'route', 'model'), u->>'question'
  from jsonb_array_elements(coalesce(p_unanswered, '[]'::jsonb)) u
  where coalesce(u->>'question', '') <> '';
end $$;

ALTER FUNCTION "public"."ins_record"("p_conversation" "uuid", "p_events" "jsonb", "p_product" "text", "p_unanswered" "jsonb") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_search_chunks"("query_embedding" "extensions"."vector", "query_text" "text", "match_count" integer DEFAULT 5, "plan_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("chunk_id" "uuid", "doc_id" "uuid", "doc_title" "text", "page" integer, "content" "text", "score" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  with by_vector as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rank
    from public.ins_doc_chunks c
    join public.ins_knowledge_docs d on d.id = c.doc_id
    where d.is_active
      and (plan_filter is null or d.plan_code is null or d.plan_code = plan_filter)
      and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit 8
  ),
  by_text as (
    select c.id, row_number() over (order by pgroonga_score(c.tableoid, c.ctid) desc) as rank
    from public.ins_doc_chunks c
    join public.ins_knowledge_docs d on d.id = c.doc_id
    where d.is_active
      and (plan_filter is null or d.plan_code is null or d.plan_code = plan_filter)
      and c.content &@~ query_text
    order by pgroonga_score(c.tableoid, c.ctid) desc
    limit 8
  ),
  fused as (
    select id, sum(1.0 / (60 + rank)) as score
    from (select id, rank from by_vector union all select id, rank from by_text) both_arms
    group by id
  )
  select c.id, c.doc_id, d.title, c.page, c.content, f.score
  from fused f
  join public.ins_doc_chunks c on c.id = f.id
  join public.ins_knowledge_docs d on d.id = c.doc_id
  order by f.score desc
  limit match_count;
$$;

ALTER FUNCTION "public"."ins_search_chunks"("query_embedding" "extensions"."vector", "query_text" "text", "match_count" integer, "plan_filter" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_search_faq"("query_embedding" "extensions"."vector", "match_count" integer DEFAULT 3) RETURNS TABLE("id" "uuid", "question" "text", "answer" "text", "score" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select f.id, f.question, f.answer, 1 - (f.embedding <=> query_embedding) as score
  from public.ins_faq f
  where f.enabled and f.embedding is not null
  order by f.embedding <=> query_embedding
  limit match_count;
$$;

ALTER FUNCTION "public"."ins_search_faq"("query_embedding" "extensions"."vector", "match_count" integer) OWNER TO "postgres";

CREATE FUNCTION "public"."ins_set_api_key"("p_provider" "text", "p_key" "text", "p_passphrase" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  insert into public.ins_api_keys (provider, key_cipher, tail, updated_at)
  values (p_provider, extensions.pgp_sym_encrypt(p_key, p_passphrase), right(p_key, 4), now())
  on conflict (provider) do update
    set key_cipher = excluded.key_cipher, tail = excluded.tail, updated_at = now();
$$;

ALTER FUNCTION "public"."ins_set_api_key"("p_provider" "text", "p_key" "text", "p_passphrase" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_set_channel_auth"("p_key" "text", "p_page_id" "text", "p_page_name" "text", "p_token" "text", "p_scopes" "text"[], "p_fields" "text"[], "p_passphrase" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  insert into public.ins_channel_auth (key, page_id, page_name, token_cipher, scopes, fields, updated_at)
  values (p_key, p_page_id, p_page_name,
          extensions.pgp_sym_encrypt(p_token, p_passphrase),
          coalesce(p_scopes, '{}'), coalesce(p_fields, '{}'), now())
  on conflict (key) do update
    set page_id = excluded.page_id, page_name = excluded.page_name,
        token_cipher = excluded.token_cipher, scopes = excluded.scopes,
        fields = excluded.fields, updated_at = now();
$$;

ALTER FUNCTION "public"."ins_set_channel_auth"("p_key" "text", "p_page_id" "text", "p_page_name" "text", "p_token" "text", "p_scopes" "text"[], "p_fields" "text"[], "p_passphrase" "text") OWNER TO "postgres";

CREATE FUNCTION "public"."ins_sweep_followups"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.ins_chat_followups where expires_at <= now();
$$;

ALTER FUNCTION "public"."ins_sweep_followups"() OWNER TO "postgres";

CREATE FUNCTION "public"."requeue_running_jobs"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  n integer;
begin
  update jobs set status = 'queued', locked_at = null, locked_by = null, updated_at = now()
   where status = 'running';
  get diagnostics n = row_count;
  return n;
end;
$$;

ALTER FUNCTION "public"."requeue_running_jobs"() OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."claim_next_job"("p_worker" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_next_job"("p_worker" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."cost_spent_in_month"("p_month" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cost_spent_in_month"("p_month" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_api_client_use"("p_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_api_client_use"("p_hash" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_arm_followup"("p_channel" "text", "p_user_hash" "text", "p_psid" "text", "p_due_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_passphrase" "text", "p_page_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_arm_followup"("p_channel" "text", "p_user_hash" "text", "p_psid" "text", "p_due_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_passphrase" "text", "p_page_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_attribute"("p_conversation" "uuid", "p_source" "text", "p_ad_id" "text", "p_ref" "text", "p_referral" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_attribute"("p_conversation" "uuid", "p_source" "text", "p_ad_id" "text", "p_ref" "text", "p_referral" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_claim_followups"("p_channel" "text", "p_passphrase" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_claim_followups"("p_channel" "text", "p_passphrase" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_clear_channel_auth"("p_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_clear_channel_auth"("p_key" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_drop_followup"("p_channel" "text", "p_user_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_drop_followup"("p_channel" "text", "p_user_hash" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_followup_second_due"("p_quoted" timestamp with time zone, "p_expires" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_followup_second_due"("p_quoted" timestamp with time zone, "p_expires" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_get_api_keys"("p_passphrase" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_get_api_keys"("p_passphrase" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_get_channel_auth"("p_key" "text", "p_passphrase" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_get_channel_auth"("p_key" "text", "p_passphrase" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_get_lead_psid"("p_lead" "uuid", "p_passphrase" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_get_lead_psid"("p_lead" "uuid", "p_passphrase" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_month_spend"("p_since" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_month_spend"("p_since" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_open_conversation"("p_channel" "text", "p_page_id" "text", "p_user_hash" "text", "p_source" "text", "p_ad_id" "text", "p_ref" "text", "p_referral" "jsonb", "p_entry_payload" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_open_conversation"("p_channel" "text", "p_page_id" "text", "p_user_hash" "text", "p_source" "text", "p_ad_id" "text", "p_ref" "text", "p_referral" "jsonb", "p_entry_payload" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_open_lead"("p_conversation" "uuid", "p_psid" "text", "p_passphrase" "text", "p_stage" "text", "p_product" "text", "p_form_ref" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_open_lead"("p_conversation" "uuid", "p_psid" "text", "p_passphrase" "text", "p_stage" "text", "p_product" "text", "p_form_ref" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_prune"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_prune"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_record"("p_conversation" "uuid", "p_events" "jsonb", "p_product" "text", "p_unanswered" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_record"("p_conversation" "uuid", "p_events" "jsonb", "p_product" "text", "p_unanswered" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_search_chunks"("query_embedding" "extensions"."vector", "query_text" "text", "match_count" integer, "plan_filter" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_search_chunks"("query_embedding" "extensions"."vector", "query_text" "text", "match_count" integer, "plan_filter" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_search_faq"("query_embedding" "extensions"."vector", "match_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_search_faq"("query_embedding" "extensions"."vector", "match_count" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_set_api_key"("p_provider" "text", "p_key" "text", "p_passphrase" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_set_api_key"("p_provider" "text", "p_key" "text", "p_passphrase" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_set_channel_auth"("p_key" "text", "p_page_id" "text", "p_page_name" "text", "p_token" "text", "p_scopes" "text"[], "p_fields" "text"[], "p_passphrase" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_set_channel_auth"("p_key" "text", "p_page_id" "text", "p_page_name" "text", "p_token" "text", "p_scopes" "text"[], "p_fields" "text"[], "p_passphrase" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ins_sweep_followups"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ins_sweep_followups"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."requeue_running_jobs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."requeue_running_jobs"() TO "service_role";

CREATE VIEW "public"."v_ins_ad_attribution" WITH ("security_invoker"='true') AS
 WITH "c" AS (
         SELECT (("ins_conversations"."started_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date" AS "day",
            "ins_conversations"."ad_id",
            "count"(*) AS "conversations",
            "count"("ins_conversations"."priced_at") AS "priced",
            "count"("ins_conversations"."form_sent_at") AS "form_sent"
           FROM "public"."ins_conversations"
          WHERE ("ins_conversations"."ad_id" IS NOT NULL)
          GROUP BY ((("ins_conversations"."started_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date"), "ins_conversations"."ad_id"
        ), "l" AS (
         SELECT (("ins_leads"."created_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date" AS "day",
            "ins_leads"."ad_id",
            "count"(*) AS "leads"
           FROM "public"."ins_leads"
          WHERE ("ins_leads"."ad_id" IS NOT NULL)
          GROUP BY ((("ins_leads"."created_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date"), "ins_leads"."ad_id"
        )
 SELECT "a"."date",
    "a"."ad_id",
    "a"."ad_name",
    "a"."campaign_name",
    "a"."spend",
    "a"."impressions",
    "a"."link_clicks",
    "a"."messaging_started",
    COALESCE("c"."conversations", (0)::bigint) AS "conversations",
    COALESCE("c"."priced", (0)::bigint) AS "priced",
    COALESCE("c"."form_sent", (0)::bigint) AS "form_sent",
    COALESCE("l"."leads", (0)::bigint) AS "leads",
        CASE
            WHEN (COALESCE("c"."priced", (0)::bigint) > 0) THEN "round"(("a"."spend" / ("c"."priced")::numeric), 2)
            ELSE NULL::numeric
        END AS "cost_per_priced",
        CASE
            WHEN (COALESCE("l"."leads", (0)::bigint) > 0) THEN "round"(("a"."spend" / ("l"."leads")::numeric), 2)
            ELSE NULL::numeric
        END AS "cost_per_lead"
   FROM (("public"."ins_ad_daily" "a"
     LEFT JOIN "c" ON ((("c"."day" = "a"."date") AND ("c"."ad_id" = "a"."ad_id"))))
     LEFT JOIN "l" ON ((("l"."day" = "a"."date") AND ("l"."ad_id" = "a"."ad_id"))));

ALTER VIEW "public"."v_ins_ad_attribution" OWNER TO "postgres";

CREATE VIEW "public"."v_ins_funnel_daily" WITH ("security_invoker"='true') AS
 SELECT (("started_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date" AS "day",
    COALESCE("product", 'undecided'::"text") AS "product",
    "count"(*) AS "conversations",
    "count"(*) FILTER (WHERE ("source" = 'ads'::"text")) AS "from_ads",
    "count"("priced_at") AS "priced",
    "count"("form_sent_at") AS "form_sent",
    "count"("form_done_at") AS "form_done",
    "count"("agent_replied_at") AS "agent_replied",
    "count"("stalled_at") AS "stalled",
    "count"("handover_at") AS "handed_over"
   FROM "public"."ins_conversations"
  GROUP BY ((("started_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date"), COALESCE("product", 'undecided'::"text");

ALTER VIEW "public"."v_ins_funnel_daily" OWNER TO "postgres";

CREATE VIEW "public"."v_ins_model_cost_daily" WITH ("security_invoker"='true') AS
 SELECT (("created_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date" AS "day",
    "task",
    "count"(*) AS "calls",
    "sum"("cost_thb") AS "cost_thb"
   FROM "public"."ins_usage_ledger"
  GROUP BY ((("created_at" AT TIME ZONE 'Asia/Bangkok'::"text"))::"date"), "task";

ALTER VIEW "public"."v_ins_model_cost_daily" OWNER TO "postgres";

CREATE VIEW "public"."v_ins_quotes" WITH ("security_invoker"='true') AS
 SELECT "e"."at",
    "e"."conversation_id",
    "c"."source",
    "c"."ad_id",
    ("e"."data" ->> 'planCode'::"text") AS "plan_code",
    ("e"."data" ->> 'variant'::"text") AS "variant",
    (("e"."data" ->> 'age'::"text"))::integer AS "age",
    ("e"."data" ->> 'sex'::"text") AS "sex",
    (("e"."data" ->> 'sumAssured'::"text"))::bigint AS "sum_assured",
    (("e"."data" ->> 'coverWanted'::"text"))::bigint AS "cover_wanted",
    (("e"."data" ->> 'monthly'::"text"))::numeric AS "monthly",
    (("e"."data" ->> 'annual'::"text"))::numeric AS "annual"
   FROM ("public"."ins_events" "e"
     JOIN "public"."ins_conversations" "c" ON (("c"."id" = "e"."conversation_id")))
  WHERE ("e"."kind" = 'quoted'::"text");

ALTER VIEW "public"."v_ins_quotes" OWNER TO "postgres";

GRANT ALL ON TABLE "public"."v_ins_ad_attribution" TO "service_role";

GRANT ALL ON TABLE "public"."v_ins_funnel_daily" TO "service_role";

GRANT ALL ON TABLE "public"."v_ins_model_cost_daily" TO "service_role";

GRANT ALL ON TABLE "public"."v_ins_quotes" TO "service_role";


-- UnitClub's default privileges hand every new table and function in public to anon and
-- authenticated, which here are UnitOS's tenant keys. None of these is theirs to reach.
do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'S')
      and (c.relname like 'ins\_%' or c.relname like 'v\_ins\_%'
           or c.relname = any (array['model_configs', 'projects', 'assets', 'brand_kits', 'jobs',
                                     'job_step_cache', 'cost_entries', 'settings']))
  loop
    execute format('revoke all on %s from anon, authenticated', r.rel);
  end loop;
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'ins\_%'
           or p.proname = any (array['claim_next_job', 'cost_spent_in_month', 'requeue_running_jobs']))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.fn);
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end $$;
