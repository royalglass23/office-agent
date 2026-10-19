---
status: accepted
date: 2026-10-20
---

# Offer bounded Job advice in the Office Assistant conversation

The owner wants Office Agent to work like a Royal Glass chat assistant inside ServiceM8. Staff
may ask what to do next for one selected Job. An email draft appears only when staff ask for an
email. The assistant does not require staff to choose a recipient before it recommends a next
action; a suggested contact is shown with any draft for staff review.

This decision extends the initial read-only proof purpose in ADR 0001 and ADR 0002 to include
suggested next actions. The current implementation may use only the already approved selected
Job fields, customer fields and Job diary notes. It must show that email, SMS, forms, attachments
and schedule activity were not checked. The owner accepted this partial-record recommendation
with that warning. A recommendation is advice for staff review, not a statement that no other
relevant diary event exists.

The model selects a relevant Job note, an exact excerpt, and a suggested contact. The server
verifies the note reference and excerpt, derives a limited follow-up topic from that excerpt,
and writes cautious next-step wording. When staff explicitly ask for email, the server assembles
an editable, review-only question about that topic. Model-written action and question text are
never displayed because a matching quote cannot verify their meaning. This first version cannot
compose a full narrative email from the diary. Nothing is sent or saved to ServiceM8. The
source-coverage audit and full Job Diary work in RG-380 and RG-381 remain necessary before the
assistant can claim to analyse the complete Diary.
