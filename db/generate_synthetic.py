# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Generate SYNTHETIC TallyBard ledger data -> db/seeds.sql + db/data/ledger.csv.

Everything produced here is synthetic: fake people, fake +8801700xxxxxx phone
numbers, fake amounts. The generator bakes a latent late-payment propensity per
client plus amount/kind effects so a model has real signal to learn; the CSV is
the flat feature+label table the risk sidecar backtests on.

Usage: uv run db/generate_synthetic.py
"""
import csv
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

SEED = 20261016
random.seed(SEED)
NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # NAMESPACE_DNS

N_CLIENTS = 60
N_RECEIVABLES = 300
NOW = datetime(2026, 10, 15, tzinfo=timezone.utc)  # fixed anchor for determinism

NAMES_BN = [
    "Rahim Uddin", "Fatema Begum", "Karim Sikder", "Nusrat Jahan", "Anika Rahman",
    "Tanvir Hasan", "Shabnam Akter", "Mehedi Hasan", "Rokeya Sultana", "Imran Hossain",
    "Salma Khatun", "Arif Chowdhury", "Dipa Rani Das", "Sabbir Ahmed", "Maksuda Parvin",
    "Jahangir Alam", "Ruma Khatun", "Farhan Kabir", "Shumi Akhter", "Nasir Uddin",
    "Poly Rani", "Shafiqul Islam", "Munni Begum", "Rasel Mahmud", "Tania Sultana",
    "Babul Hossain", "Shimul Das", "Ayesha Siddika", "Naimur Rahman", "Hafsa Begum",
]
NAMES_OTHER = [
    "David Chen", "Maya Krishnan", "Sofia Ahmed", "James Okoro", "Lina Rahman",
    "Omar Faruk", "Priya Sharma", "Alex Gomes", "Sara Islam", "Ratan Kumar",
    "Elena Petrov", "Habib Chaudhry", "Nadia Yasmin", "Victor Das", "Rina Talukdar",
    "Kamal Mia", "Bithi Saha", "Shamim Reza", "Lotifa Akter", "Jamal Sheikh",
    "Puja Mondal", "Riyad Karim", "Mukta Rani", "Selim Howlader", "Tumpa Begum",
    "Asif Iqbal", "Rikta Sen", "Sohel Rana", "Champa Khatun", "Gopal Sarker",
]
NOTES_SNIPPETS = [
    "bikashe pathay", "pays after salary day", "WhatsApp e reply kore",
    "prefers evening calls", "cash dile neme", "ঈদের পরে দেয়",
    "usually needs 2 reminders", "shop closed on Fridays", "pays in installments",
    "বিকাশ নম্বর আছে", "responsive on WhatsApp", "slow during harvest season",
    "settled old udhaar on time", "বাকির হিসাব খাতায়", "asked for invoice copy",
]
KINDS = ["invoice"] * 18 + ["udhaar"] * 10 + ["other"] * 2  # 60/33/7
PROPENSITIES = [0.10] * 20 + [0.40] * 25 + [0.75] * 15  # reliable/average/risky
LANGS = ["bn"] * 36 + ["en"] * 15 + ["mixed"] * 9


def esc(s: str) -> str:
    return s.replace("'", "''")


def main() -> None:
    out_dir = Path(__file__).resolve().parent
    (out_dir / "data").mkdir(exist_ok=True)

    clients = []
    for i in range(N_CLIENTS):
        cid = str(uuid.uuid5(NS, f"tallybard-synth-client-{i}"))
        name = (NAMES_BN + NAMES_OTHER)[i]
        phone = f"+8801700{i:06d}"  # reserved synthetic range
        clients.append(
            dict(id=cid, name=name, phone=phone,
                 lang=LANGS[i % len(LANGS)],
                 propensity=PROPENSITIES[i % len(PROPENSITIES)])
        )

    receivables = []
    payments = []
    for i in range(N_RECEIVABLES):
        rid = str(uuid.uuid5(NS, f"tallybard-synth-recv-{i}"))
        c = clients[i % N_CLIENTS]
        issued = NOW - timedelta(days=random.randint(1, 240))
        terms = random.choice([7, 14, 21, 30, 45])
        due = issued + timedelta(days=terms)
        kind = KINDS[i % len(KINDS)]
        if kind == "udhaar":
            amount = round(random.uniform(200, 6_000), 2)
        else:
            amount = round(random.uniform(500, 50_000), 2)
        # latent behaviour: propensity + amount + kind effects
        p_late = min(0.97, c["propensity"]
                     + 0.10 * (amount > 20_000)
                     + 0.12 * (kind == "udhaar")
                     + 0.05 * (terms <= 7))
        open_ = random.random() < 0.25
        paid_at = None
        if not open_ or due < NOW - timedelta(days=60):
            paid = random.random() < 0.85
            if paid:
                if random.random() < p_late:
                    lag = random.randint(8, 45)          # late: >7d after due
                else:
                    lag = random.randint(-3, 6)          # on time
                paid_at = due + timedelta(days=lag)
        status = ("paid" if paid_at else
                  "pending" if due > NOW else "overdue")
        receivables.append(dict(
            id=rid, client_id=c["id"], amount=amount, kind=kind,
            channel="whatsapp" if random.random() < 0.8 else "sms",
            issued_at=issued, due_date=due, paid_at=paid_at, status=status))
        if paid_at:
            payments.append(dict(
                id=str(uuid.uuid5(NS, f"tallybard-synth-pay-{i}")),
                receivable_id=rid, amount=amount, paid_at=paid_at,
                method=random.choice(["bkash", "cash", "bank", "nagad"])))

    nudges = []
    tones = ["friendly", "firm", "final"]
    for i, r in enumerate([r for r in receivables if r["status"] == "overdue"][:20]):
        nid = str(uuid.uuid5(NS, f"tallybard-synth-nudge-{i}"))
        tone = tones[i % 3]
        lang = ["bn", "en", "mixed"][i % 3]
        text = {
            "bn": f"আসসালামু আলাইকুম, আপনার {r['amount']:.0f} টাকার বাকিটা পরিশোধের অনুরোধ করছি।",
            "en": f"Hi, a gentle reminder that {r['amount']:.0f} BDT is still due. Please let us know if anything is blocking payment.",
            "mixed": f"Hi, apnar {r['amount']:.0f} taka payment ta ekhnô pending. Kindly confirm koren.",
        }[lang]
        nudges.append(dict(id=nid, receivable_id=r["id"], tone=tone,
                           language=lang, draft_text=text,
                           status="sent" if i % 4 else "approved",
                           sent_at=r["due_date"] + timedelta(days=2) if i % 4 else None))

    sql = [
        "-- SYNTHETIC DATA — generated by db/generate_synthetic.py (seed %d)" % SEED,
        "-- Not real people. Fake +8801700xxxxxx numbers.",
        "BEGIN;",
        "DELETE FROM nudges; DELETE FROM payment_events; DELETE FROM receivables;",
        "DELETE FROM client_notes; DELETE FROM clients;",
    ]
    for c in clients:
        sql.append(
            f"INSERT INTO clients (id,name,phone,preferred_language) VALUES "
            f"('{c['id']}','{esc(c['name'])}','{c['phone']}','{c['lang']}');")
    for i, c in enumerate(clients):
        for j in range(random.randint(1, 3)):
            note = NOTES_SNIPPETS[(i + j) % len(NOTES_SNIPPETS)]
            nid = str(uuid.uuid5(NS, f"tallybard-synth-note-{i}-{j}"))
            sql.append(
                f"INSERT INTO client_notes (id,client_id,body) VALUES "
                f"('{nid}','{c['id']}','{esc(note)}');")
    for r in receivables:
        sql.append(
            "INSERT INTO receivables "
            "(id,client_id,amount,currency,kind,channel,issued_at,due_date,paid_at,status) VALUES ("
            f"'{r['id']}','{r['client_id']}',{r['amount']},'BDT','{r['kind']}',"
            f"'{r['channel']}','{r['issued_at'].isoformat()}','{r['due_date'].isoformat()}',"
            + (f"'{r['paid_at'].isoformat()}'" if r["paid_at"] else "NULL")
            + f",'{r['status']}');")
    for p in payments:
        sql.append(
            "INSERT INTO payment_events (id,receivable_id,amount,paid_at,method) VALUES ("
            f"'{p['id']}','{p['receivable_id']}',{p['amount']},"
            f"'{p['paid_at'].isoformat()}','{p['method']}');")
    for n in nudges:
        sql.append(
            "INSERT INTO nudges (id,receivable_id,tone,language,draft_text,status,sent_at) VALUES ("
            f"'{n['id']}','{n['receivable_id']}','{n['tone']}','{n['language']}',"
            f"'{esc(n['draft_text'])}','{n['status']}',"
            + (f"'{n['sent_at'].isoformat()}'" if n["sent_at"] else "NULL") + ");")
    sql.append("COMMIT;")
    (out_dir / "seeds.sql").write_text("\n".join(sql) + "\n", encoding="utf-8")

    # flat labelled table for the backtest (label: paid >7d after due, or still
    # unpaid 7d past due). 'open_unknown' rows (recent, unpaid) get label '' and
    # are excluded from supervised evaluation.
    with (out_dir / "data" / "ledger.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["receivable_id", "client_id", "amount", "kind", "channel",
                    "issued_at", "due_date", "paid_at", "status",
                    "client_propensity_hidden", "label_late7"])
        for i, r in enumerate(receivables):
            c = clients[i % N_CLIENTS]
            label = ""
            if r["paid_at"]:
                label = int((r["paid_at"] - r["due_date"]).days > 7)
            elif r["due_date"] < NOW - timedelta(days=7):
                label = 1
            w.writerow([r["id"], r["client_id"], r["amount"], r["kind"],
                        r["channel"], r["issued_at"].isoformat(),
                        r["due_date"].isoformat(),
                        r["paid_at"].isoformat() if r["paid_at"] else "",
                        r["status"], c["propensity"], label])

    late = sum(1 for r in receivables
               if r["paid_at"] and (r["paid_at"] - r["due_date"]).days > 7)
    open_unknown = sum(1 for r in receivables
                       if not r["paid_at"] and r["due_date"] >= NOW - timedelta(days=7))
    print(f"clients={len(clients)} receivables={len(receivables)} "
          f"payment_events={len(payments)} nudges={len(nudges)}")
    print(f"late_labels={late + sum(1 for r in receivables if not r['paid_at'] and r['due_date'] < NOW - timedelta(days=7))} "
          f"open_unknown_excluded={open_unknown}")


if __name__ == "__main__":
    main()
