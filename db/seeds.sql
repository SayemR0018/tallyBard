-- ============================================================================
-- Synthetic Seed Data for TallyBard
-- 3 realistic test clients, receivables, and nudges
-- ============================================================================

DO $$
DECLARE
    client1_id UUID := '11111111-1111-1111-1111-111111111111';
    client2_id UUID := '22222222-2222-2222-2222-222222222222';
    client3_id UUID := '33333333-3333-3333-3333-333333333333';
    
    rec1_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    rec2_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    rec3_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    nudge1_id UUID := 'd1111111-1111-1111-1111-111111111111';
    nudge2_id UUID := 'd2222222-2222-2222-2222-222222222222';
    nudge3_id UUID := 'd3333333-3333-3333-3333-333333333333';
BEGIN
    -- 1. Insert 3 Synthetic Clients
    INSERT INTO clients (id, name, phone, preferred_language, notes, notes_embedding)
    VALUES
        (
            client1_id,
            'Elena Rostova',
            '+1-555-019-2831',
            'en',
            'Wholesale ceramics distributor. Consistently pays 10-15 days after invoice due date.',
            array_fill(0.05::real, ARRAY[768])::vector(768)
        ),
        (
            client2_id,
            'Carlos Hernandez',
            '+1-555-014-9823',
            'es',
            'Organic coffee beans importer. Prefers WhatsApp reminders in Spanish.',
            array_fill(0.12::real, ARRAY[768])::vector(768)
        ),
        (
            client3_id,
            'Amina Mansour',
            '+1-555-017-4490',
            'en',
            'Boutique textile supplier. Very responsive to courteous SMS follow-ups.',
            array_fill(0.08::real, ARRAY[768])::vector(768)
        )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        preferred_language = EXCLUDED.preferred_language,
        notes = EXCLUDED.notes,
        notes_embedding = EXCLUDED.notes_embedding,
        updated_at = now();

    -- 2. Insert 3 Synthetic Receivables
    INSERT INTO receivables (id, client_id, amount, issued_at, due_date, paid_at, status, kind, channel)
    VALUES
        (
            rec1_id,
            client1_id,
            1450.00,
            now() - INTERVAL '30 days',
            now() - INTERVAL '5 days',
            NULL,
            'overdue',
            'invoice',
            'sms'
        ),
        (
            rec2_id,
            client2_id,
            3200.50,
            now() - INTERVAL '15 days',
            now() + INTERVAL '10 days',
            NULL,
            'pending',
            'invoice',
            'whatsapp'
        ),
        (
            rec3_id,
            client3_id,
            890.00,
            now() - INTERVAL '45 days',
            now() - INTERVAL '15 days',
            now() - INTERVAL '2 days',
            'paid',
            'invoice',
            'sms'
        )
    ON CONFLICT (id) DO UPDATE SET
        client_id = EXCLUDED.client_id,
        amount = EXCLUDED.amount,
        issued_at = EXCLUDED.issued_at,
        due_date = EXCLUDED.due_date,
        paid_at = EXCLUDED.paid_at,
        status = EXCLUDED.status,
        kind = EXCLUDED.kind,
        channel = EXCLUDED.channel,
        updated_at = now();

    -- 3. Insert 3 Synthetic Nudges
    INSERT INTO nudges (id, receivable_id, tone, language, draft_text, sent_at)
    VALUES
        (
            nudge1_id,
            rec1_id,
            'polite',
            'en',
            'Hi Elena, friendly reminder from TallyBard: invoice #1042 for $1,450.00 was due on Oct 10. Please let us know if you need any assistance processing payment.',
            now() - INTERVAL '3 days'
        ),
        (
            nudge2_id,
            rec2_id,
            'gentle',
            'es',
            'Hola Carlos, le recordamos que la factura #1055 por $3,200.50 vencerá el 25 de octubre. Quedamos a su disposición para cualquier consulta.',
            NULL
        ),
        (
            nudge3_id,
            rec3_id,
            'firm',
            'en',
            'Hello Amina, invoice #1019 for $890.00 is currently 10 days past due. Please confirm receipt and let us know your payment schedule.',
            now() - INTERVAL '5 days'
        )
    ON CONFLICT (id) DO UPDATE SET
        receivable_id = EXCLUDED.receivable_id,
        tone = EXCLUDED.tone,
        language = EXCLUDED.language,
        draft_text = EXCLUDED.draft_text,
        sent_at = EXCLUDED.sent_at;
END $$;
