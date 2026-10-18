# Royal Glass Office Assistant

The Office Assistant is a staff-facing conversation opened globally from ServiceM8. It helps an
authenticated staff member understand and prepare work from ServiceM8 records without changing or
sending anything on the staff member's behalf.

## Language

**Office Assistant**:
A global, staff-bound conversation that combines Royal Glass knowledge with authorised ServiceM8
Job information.
_Avoid_: Job Action, generic chatbot

**Global Launch**:
Opening the Office Assistant independently of any Job card from the ServiceM8 Add-ons menu.
_Avoid_: Job launch, current Job

**Account-wide Job Access**:
Royal Glass staff in the connected ServiceM8 account can view the same Jobs; there is no per-staff
Job restriction to reproduce in the Office Assistant. Staff identity still binds each conversation
and every ServiceM8 request to the person who launched it.
_Avoid_: Michael-only Job, Carla-denied Job

**Selected Job**:
The Job a staff member deliberately finds and confirms inside an Office Assistant conversation.
It is not inherited from the page that happened to be open before the Global Launch.
_Avoid_: Current Job, callback Job

**Job Reference**:
An address or Job number supplied in conversation to find a Job. Address is the normal staff usage;
Job number is the precise alternative.
_Avoid_: Job ID, Job UUID

**Job Match**:
A Job returned by an authorised search for a Job Reference. When several Jobs match, none becomes
the Selected Job until the staff member explicitly chooses it.
_Avoid_: Search hit, assumed Job

**Approved Proof Provider**:
OpenAI's API, used only for the staff-selected Job and the read-only “What happened?” Proof Answer
or review-only Email Draft. The model remains configuration rather than a domain concept, and this
approval does not extend to other sources, purposes, providers, or unselected Jobs.
_Avoid_: General AI approval, unrestricted production AI

**Observed Job Facts**:
Information read from ServiceM8 that describes what has happened on a Selected Job.
_Avoid_: AI assumptions, inferred history

**Proof Answer**:
The provisional response to “What happened to this Job?”: a short plain-English summary followed
by a dated evidence timeline from the Initial Job Context. This format exists to make the first
proof easy for staff to verify and may change after the proof.
_Avoid_: Final response design, permanent answer format

**Initial Job Context**:
The evidence available to the first release: core fields from the Selected Job and its customer,
plus Job diary notes. Responses must identify this coverage and must not imply that it contains the
whole ServiceM8 history.
_Avoid_: Complete Job history, full diary

**Extended Job History**:
Additional ServiceM8 evidence such as email, SMS, forms, attachments, and schedule activity. These
sources are deferred from the first release but remain necessary before the Office Assistant can
claim a complete operational history.
_Avoid_: Optional context, already covered

**Suggested Next Action**:
A clearly labelled recommendation based on Observed Job Facts; it is not a ServiceM8 status change,
task, assignment, or approval. This capability is deferred until the initial read-only proof works.
_Avoid_: Next step, automated action

**Email Draft**:
Proposed email subject and body constructed by server code for a deliberately Selected Job and a
staff-supplied purpose, using evidence IDs selected by the Approved Proof Provider from the same
Initial Job Context as the Proof Answer. It is shown for review and copying and is never sent or
saved to ServiceM8 by the Office Assistant.
_Avoid_: Email, outbound message
