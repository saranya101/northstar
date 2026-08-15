export const NTU_MAIL_FIXTURES = Object.freeze({
  ccaRecruitment: `From: NBS Investment Banking Club <ibc@example.edu.sg>
Subject: IBC Sales & Trading Recruitment
Sent: 15 August 2026, 09:30 AM
Applications are open for freshmen interested in finance.
Eligibility: Freshmen eligible
Applications close: 18 Aug 2026, 23:59
Apply: https://example.edu.sg/forms/ibc-recruitment`,
  internship: `Subject: Summer Analyst Internship
Organisation: Example Capital
Applications are open for a summer internship.
Deadline: 30 September 2026 at 17:00
Application: https://careers.example.com/apply/internship`,
  competition: `Subject: ASEAN Analytics Competition
Organisation: Analytics Society
Form a student team for this competition.
Apply by: 12 October 2026 at 12:00
https://example.org/forms/analytics-challenge`,
  exchange: `Subject: GEM Explorer Applications
Organisation: NTU Global
Applications are open for the GEM Explorer exchange programme.
Deadline: Week 3 of Semester 2
Eligibility: Full-time undergraduates`,
  scholarship: `Subject: Future Leaders Scholarship
Organisation: Example Foundation
Call for applications for a scholarship supporting university students.
Deadline: 2 November 2026 at 23:59
https://foundation.example/apply`,
  mentorship: `Subject: Women in Business Mentorship
Organisation: NBS Alumni Network
Applications are open for a six-month mentorship programme.
Commitment: Two hours each month
Apply by: 25 August 2026 at 18:00
https://example.edu.sg/forms/mentorship`,
  requiredAdmin: `From: Office of Academic Services <oas@example.edu.sg>
Subject: Action required: student declaration
You are required to complete the student declaration form.
Submit by: 20 August 2026 at 17:00
https://example.edu.sg/forms/declaration`,
  venueChange: `Subject: AB1201 seminar venue change
AB1201 Seminar Group 11 has moved from ESR4 to LT1 from 17 August 2026.
No response is required.`,
  networkingEvent: `Subject: Employer networking session
Organisation: Example Bank
Join our employer networking event.
Date: 27 August 2026 at 18:30
Venue: NBS Lounge
Register: https://events.example.com/networking`,
  newsletter: `Subject: Campus weekly newsletter
This weekly digest contains general publicity and highlights from around campus.
Manage preferences or unsubscribe at https://example.edu.sg/preferences`,
  ambiguous: `Subject: A quick update
Hello students, please note that more information will be shared soon.
Thank you for your attention.`,
  internshipNoDeadline: `From: NBS Careers <careers@ntu.edu.sg>
Sent: Saturday, 15 August 2026 09:00
To: Student <student@e.ntu.edu.sg>
Subject: Summer Analyst Internship

Dear student,
Organisation: Example Capital
Applications are open for a summer internship.
Apply: https://careers.example.com/internship

Regards,
NBS Careers`,
  ccaDeadline: `From: NTU Student Life <studentlife@ntu.edu.sg>
Sent: Saturday, 15 August 2026 10:00
To: Student <student@e.ntu.edu.sg>
Subject: CCA Recruitment 2026

Hello students,
Organisation: Adventure Club
Applications are open for CCA recruitment.
Deadline: 25 August 2026 at 23:59
Apply: https://example.edu.sg/cca`,
  subjectless: `From the Office of Student Affairs

Dear students,

This is a subjectless informational message with several paragraphs.

Please read the attached guidance when convenient.

Regards,
Student Affairs`,
  ambiguousMultiple: `Subject: First student update
Hello students, this is the first update.
Regards,
Office A
--------------------
Subject: Second student update
Hello students, this may be another message.`,
  forwarded: `Subject: Fwd: Employer briefing
Hello,
Please see the forwarded message below.

-----Original Message-----
From: Employer Relations <employer@ntu.edu.sg>
Sent: Saturday, 15 August 2026 11:00
To: Students <students@e.ntu.edu.sg>
Subject: Employer briefing

Join the employer webinar next week.`
})

export const TWO_EMAIL_PASTE = `${NTU_MAIL_FIXTURES.internshipNoDeadline}\n\n${NTU_MAIL_FIXTURES.ccaDeadline}`
export const FOUR_EMAIL_PASTE = [
  NTU_MAIL_FIXTURES.internshipNoDeadline,
  NTU_MAIL_FIXTURES.ccaDeadline,
  `From: Academic Office <academic@ntu.edu.sg>\nSent: 15 August 2026 11:00\nTo: Student <student@e.ntu.edu.sg>\nSubject: AB1201 venue update\n\nAB1201 seminar venue has changed to LT1.`,
  `From: Campus News <news@ntu.edu.sg>\nSent: 15 August 2026 12:00\nTo: Student <student@e.ntu.edu.sg>\nSubject: Campus weekly newsletter\n\nThis weekly digest contains general publicity. Unsubscribe in the footer.`
].join('\n\n')
