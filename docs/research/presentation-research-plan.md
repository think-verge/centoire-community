# Centoire: research and presentation plan

Prepared 14 September 2026. Code reviewed at commit `980a623`.

This is an evidence-led plan for improving three presentations: product, investor pitch, and competitor analysis. It includes an initial desk-research pass and review of both supplied Canva drafts. It is not a completed market study, customer-validation exercise, or final set of presentations.

Companion files:

- [Draft slide audit](draft-slide-audit.md): corrections across the 28 supplied slides.
- [Source register](source-register.md): initial external evidence, interpretation limits, and further research.

## 1. Recommended strategic starting point

Build the story around a specific recurring task: helping fashion and art creatives find relevant industry information, discuss it with useful peers, and publish their own perspective. Test whether this combination creates a weekly habit and a reason to pay.

Working positioning for research: **“Centoire brings industry discovery, creative publishing, and specialist communities together for people building a practice in fashion and art.”**

Treat “AI-powered” as a supporting explanation of how the experience improves. Quantify relevance, time saved, or moderation quality before claiming superior intelligence. A working feed and third-party AI integration are not evidence of a proprietary forecasting advantage.

Start by comparing emerging fashion designers/creators with art practitioners as separate segments. Fashion has more explicit existing community examples in the repository, but that is a product observation, not proof of stronger market demand. Research both before deciding whether to launch them together. Keep the wider fashion-and-art vision visible while selecting one initial audience and job to serve exceptionally well.

Geography remains unconfirmed. Research India-first and global English-language launch scenarios separately. Toronto and Delhi appear in the investor draft; they do not establish company jurisdiction, launch territory, or operating footprint. Do not infer any of those from the founder's location.

## 2. What the current evidence establishes

| Area | Repository evidence | Presentation treatment |
| --- | --- | --- |
| Community core | Feed/Discover, publishing/drafts, Circles, follows, comments, voting, bookmarks, reputation, notifications, and moderation have implementation files | Describe as implemented in the repository; demonstrate and verify production before labeling live |
| Personalization | `backend/src/services/feedService.ts` ranks using interests, engagement, follows, Circles, creator affinity, recency, and an optional AI quality score | Explain relevance simply; do not call this proprietary trend forecasting |
| AI content processing | `ai-agent/app/graphs/post_processor.py` implements classification, summaries, tags, quality/spam/clickbait signals; backend invocation is feature gated | Verify enabled state, successful processing, coverage, failures, latency, and cost |
| AI search | `backend/src/services/agentSearchService.ts` translates natural-language requests into structured filters | Describe this specific function. README says production UI AI search is disabled; current runtime status remains unverified |
| Sources | `backend/scripts/seed.ts` defines 52 entries, eight explicitly inactive, 44 enabled by default | Configured source count is not successfully ingested source count or a publisher partnership |
| Taxonomy | Six categories and 46 subcategories in `backend/src/config/categoryTaxonomy.ts` | Valid implementation scope; not six proven audience markets |
| Circles | Six seed definitions | Seeded examples, not six active communities or evidence of retention |
| Exclusive sections | `ui/src/App.tsx` routes jobs, certification, research, AI tools, startup/investor, and buyer/manufacturer pages to `ExclusivePage` | Clearly mark as planned/Coming Soon; remove from current competitive advantages |
| Paid products | Prices occur in the draft; implementation reviewed does not establish operating paid tiers or revenue | Pricing hypotheses pending founder confirmation and demand tests |

Internal documentation has drifted. The older strategy DOCX says notifications do not exist, but notification implementation files are now present. It also proposes a different vertical scope from the current six-category taxonomy. Use code, runtime evidence, and current founder decisions to reconcile the narrative; do not repeat older strategy assertions such as an already established moat.

## 3. Research questions and decision outputs

| Workstream | Questions and method | Evidence/output | Decision enabled |
| --- | --- | --- | --- |
| Customer need | Observe how designers, creators, artists, and small brands discover information, obtain feedback, and find opportunities | Interviews, workflow diaries, current alternatives, recent spending | Initial audience and primary use case |
| Fashion landscape | Examine creative workflows, industry information spend, AI adoption, independent practice, and educational access | McKinsey/BoF; occupational and institution data; association reports; buyer interviews | A grounded “why now” and realistic buyer definition |
| Art landscape | Separate working artists, illustrators, galleries, curators, and collectors; assess discovery, critique, credibility, and opportunity needs | Art Basel/UBS; official occupation data; institution reports; interviews | Whether art shares the core habit or needs a separate proposition |
| Competition | Test the same user tasks across direct competitors and substitutes | Dated evidence matrix, pricing records, task walkthroughs | Positioning, build priorities, partnerships |
| Market sizing | Count identifiable potential customers and actual relevant spending | Bottom-up model with low/base/high assumptions and deduplication | Credible TAM/SAM/SOM |
| Monetization | Identify payer, paid outcome, current alternative, budget, and purchase authority | Price tests, proposed pilot commitments, cost model | First paid offer and launch timing |
| Distribution | Test reachable schools, communities, creators, institutions, and brands | Named channel inventory, conversion funnel, acquisition effort/cost | An attainable launch plan |
| AI and trust | Compare AI-assisted results with a baseline and human judgments | Relevance/quality evaluation, attribution review, operating costs | Claims the product can substantiate |

Public sources establish industry conditions and competitors' advertised capabilities. They cannot establish Centoire demand, conversion, retention, active sources, revenue, or willingness to pay.

## 4. Initial research findings to carry forward

1. **“Why now” should emphasize useful information and changing workflows.** McKinsey/BoF's 2026 report forecasts low single-digit fashion growth and describes wider AI adoption. This supports researching affordable, useful intelligence; it does not prove demand for a new community. [S01](source-register.md)
2. **Art requires its own customer model.** Art Basel/UBS reports $59.6 billion in global art sales for 2025. That is transaction value, not revenue available to a community subscription business. [S02](source-register.md)
3. **India is a plausible scenario worth testing.** BCG reports 2–2.5 million monetized creators and $350–400 billion in influenced consumer spending. These are cross-category figures, not counts of fashion/art professionals or Centoire buyers. [S03](source-register.md)
4. **The claimed empty competitive space is not established.** PI spans community, content, AI guidance, and research; FashionUnited offers fashion news, intelligence, and jobs; Artsy combines editorial, discovery, personalization, and transactions. [S05, S13, S17](source-register.md)
5. **AI and aggregation already appear in alternatives.** WGSN, Heuritech, Pinterest, Muzli, and daily.dev create substantial expectations for discovery and relevance. Research a specific workflow advantage rather than count generic features. [S06, S07, S08, S14, S15](source-register.md)

## 5. Customer research design

Proposed first round: 24 semi-structured interviews, 30–45 minutes each. This is directional qualitative research, not a representative market survey.

- Eight emerging fashion designers, stylists, or independent fashion creators.
- Six working artists, illustrators, or creative practitioners.
- Four fashion/art students or recent graduates.
- Three potential organizational buyers: independent brands, galleries, or agencies.
- Three educators, editors, or community operators who could supply expertise or distribution.

For the geographic comparison, aim for approximately half in India and half outside India, recording country and language. Do not generalize country-level differences from these small subsamples. Recruit beyond founder friends; include people who already pay for alternatives and people who have abandoned communities. No outreach has been sent.

Ask about a recent real project before showing Centoire:

1. What information did you need, and what decision did it inform?
2. Show the actual sites, groups, subscriptions, saved posts, or chats used.
3. Where did the process fail, take too long, or produce low-quality advice?
4. What did you do next, and what was the measurable consequence?
5. What have you paid for in the last year? Who controlled that budget?
6. What would cause you to return to a new community after the first week?
7. What would make you distrust an AI summary, recommendation, or contributor?
8. After a neutral product walkthrough: which existing task would this replace, and what would you stop using?

Run a seven-day diary with 8–10 participants to capture discovery episodes and actual saved/shared material. Follow with 6–8 moderated product task sessions. Test “find a relevant industry story,” “find a useful Circle,” and “publish or respond with context.” Record completion, time, failures, and spontaneous return intent. Compare with the participant's existing workflow; label findings as test results, not universal productivity claims.

Use a 100–150 response survey only after interviews clarify vocabulary and segments. Report recruitment source, sample size, response bias, and question wording; convenience samples do not provide population estimates. Separate free-interest responses from paid commitments. Hypothetical willingness to pay should be followed by a real pilot or clearly disclosed purchase-intent test.

## 6. Competitive research framework

Do not select competitors solely because they lack the future features in Centoire's roadmap. Start from what the target user already uses.

| Priority | Set | Role in analysis |
| --- | --- | --- |
| Core fashion comparisons | PI, Common Objective, FashionUnited, BoF Professional | Existing overlap in professional information, networks, education, or opportunities |
| Discovery substitutes | Instagram, Pinterest, LinkedIn, Reddit, Discord/WhatsApp groups, newsletters | Where attention and established relationships already live; verify each relevant workflow |
| Creative practice | Behance, Dribbble; assess The Dots if interviews name it | Publishing, professional identity, feedback, hiring |
| Art-specific | Artsy, Artnet, ArtConnect, ArtRabbit; screen Saatchi Art if selling work matters | Avoid reducing art competition to general design portfolios |
| Intelligence | WGSN, Heuritech; screen EDITED and Stylumia | Adjacent paid professional outcomes; do not imply news curation substitutes for forecasting |
| Wholesale | JOOR; screen comparable directories only if sourcing demand appears | Adjacent transaction infrastructure and potential partners |
| Editorial/cultural | Highsnobiety, Vogue Business, WWD; art publications surfaced in interviews | Authority, specialist coverage, attention, potential content relationships |
| Product/distribution analogues | daily.dev, Muzli | Habit formation, discovery, publishing/community patterns, monetization analogues |

Screen broadly, then deep-dive 10–12 platforms selected by customer overlap. The supplied deck's nine named comparisons can remain in the appendix if useful, but add missing core and art competitors.

For every platform, capture: audience, geography, core task, editorial sources, publishing format, community interaction, discovery/personalization, evidence of AI use, opportunities, sourcing/transactions, trust mechanisms, distribution, pricing/access, business model, and evidence date.

Use statuses **verified available / limited or tier-specific / explicitly unavailable / not verified**. Missing marketing copy is not proof that a feature does not exist. Centoire needs separate columns for **implemented**, **production verified**, and **planned**. Product presence does not establish product quality.

Use the same observable task rubric across competitors: relevance of results, steps to value, contribution options, source traceability, recurring utility, and cost/access. Avoid a numeric composite score until customer interviews establish meaningful weights. Any two-axis positioning map must define its axes and show how positions were assigned; an automatically favorable top-right location is not evidence.

Publish one-page profiles for the closest competitors: best-served audience, strengths, overlap, unmet task hypothesis, adoption barrier, likely competitive response, and Centoire implication. Treat publishers and institutions as potential partners as well as alternatives.

## 7. Market sizing and economics

Retire the draft's $47B TAM, 40M professional count, $8B SAM, and $180M Year 3 SOM until the underlying population and monetization assumptions are sourced. Correct multiplication alone does not validate a market.

Build separate individual and organization models:

```text
Individual TAM = deduplicated eligible professionals × evidenced annual spend on the proposed product category
Organization TAM = eligible organizations × evidenced annual contract value
SAM = relevant segments within reachable geographies, languages, and product capabilities × relevant annual price
Paid members[t] = paid members[t-1] × (1 − monthly churn) + new paid conversions[t]
Subscription ARR[t] = recurring monthly subscription revenue[t] × 12
SOM at month 36 = modeled recurring revenue from channel-constrained retained customers
```

Use occupational statistics and institution/association data to define designers, artists, and relevant roles. Exclude unrelated manufacturing employment and deduplicate students/professionals and overlapping fashion/art occupations. Potential source families: India PLFS and institutional annual reports, US BLS, Statistics Canada, Eurostat, UNESCO/UNCTAD, and relevant trade bodies. Definitions, dates, availability, and comparability still require verification.

Keep consumer fashion sales, art transaction value, creator-influenced spending, professional subscriptions, advertising, and wholesale GMV distinct. Do not add them into one addressable pool. Avoid counting an individual paid seat again inside a company license.

For paid tiers, record USD/INR or other currency, monthly versus annual billing, discounts, taxes, and proposed entitlements. Model low/base/high acquisition, activation, paid conversion, churn, and price assumptions. Every input gets a source or an explicit “assumption” label. Carry through AI inference, content/licensing, hosting, moderation, support, and payment costs. Define CAC to include attributable acquisition spending and labor; calculate payback using gross profit per customer. Use cohort lifetime value only when retention evidence supports it.

The first monetization test should compare a useful individual premium offer with an institutional/community pilot. Do not launch subscriptions, jobs, research, sourcing, certifications, and Studio simultaneously. Choose the first paid outcome from customer evidence. Founder decisions on actual pricing and offering scope are required before publishing prices as available.

## 8. Product and AI substantiation

Prepare a dated capability sheet and demonstrate every feature shown in the product deck. Confirm production configuration without exposing secrets. Distinguish a scheduled ingestion attempt from successful fresh content delivery.

Measure:

- Active sources with at least one successful import within a defined period; failed sources and content freshness.
- Percentage of eligible posts successfully processed by AI; error rate, latency, and cost per processed post.
- Relevance on a curated set of 50–100 representative queries judged by at least two reviewers; compare AI-assisted retrieval with conventional filters/search.
- Summary faithfulness, source attribution, and appropriate treatment of insufficient source content.
- Moderation false positives/false negatives on a labeled sample, including criticism, promotional content, non-English material, and art imagery.
- Weekly active members completing a meaningful discovery or community action; report discovery and contribution components separately.
- Activation, week-1/week-4 cohort retention, contributor retention, useful replies, and activity concentration across Circles.

For a pilot, predefine evaluation targets after observing the baseline. Keep sample sizes and uncertainty visible. Present “trust” as a process and measured result; an automated quality score is not a factual accuracy guarantee.

Check content permissions, attribution, and partner agreements for the actual sources and images used in the deck. Publisher names in seed data are not partnerships. Claims of exclusive data, verified experts, or certifications require actual supporting arrangements.

## 9. Three distinct deck narratives

### Product presentation — approximately 12 slides

Audience: prospective members, creators, and community/institution partners. Goal: make the value and first useful action clear.

| Slide | Proposed message | Evidence/visual |
| --- | --- | --- |
| 1 | Discover ideas. Share your perspective. Find your community. | Brand wordmark; clear audience statement |
| 2 | Who Centoire helps first | Two researched personas; separate fashion/art examples |
| 3 | The current workflow and its friction | Observed workflow and permissioned customer quote |
| 4 | A connected discovery-to-discussion experience | One simple user journey |
| 5 | Find relevant stories | Actual feed screenshot and source labels |
| 6 | Explore a specialist Circle | Demonstrated discussion example |
| 7 | Publish with context | Actual Compose and published post views |
| 8 | Build a useful personal collection and network | Bookmarks/follows/profile demonstration |
| 9 | How AI and moderation help | Human-readable explanation; supported availability labels |
| 10 | What works today and what comes next | Explicit current/next/later separation |
| 11 | Early user evidence or pilot invitation | Measured results if available; otherwise transparent pilot proposition |
| 12 | Join or start a partner pilot | One clear action and verified contact |

No third/product-deck link was supplied. This is a proposed structure, not a review of an unseen draft.

### Investor pitch — approximately 14 slides plus appendix

Audience: early-stage investors. Goal: explain why this audience, product, team, and route to scale can produce an investable business.

| Slide | Proposed message | Evidence/visual |
| --- | --- | --- |
| 1 | Centoire in one sentence | Audience + recurring outcome |
| 2 | A specific expensive or frequent problem | Customer evidence; no unsourced tab/site counts |
| 3 | Why now | Two or three tightly relevant industry signals |
| 4 | Initial customer and entry market | Research-supported segment; geography |
| 5 | Product in one coherent journey | Three actual product views |
| 6 | Proof so far | Cohorts, activity, pilot commitments, or honest validation stage |
| 7 | Market opportunity | Bottom-up TAM/SAM/SOM with assumptions |
| 8 | Existing alternatives and our entry point | Fair comparison of current capabilities |
| 9 | Business model | Payer, paid outcome, entitlement, price-test status |
| 10 | Distribution | Initial channels, conversion evidence, ownership |
| 11 | How advantage could compound | Expertise, permissioned data, contributor network; measurable hypotheses |
| 12 | Team | Real biographies, roles, relevant execution evidence, hiring gaps |
| 13 | Milestones and economics | 18–24 month operating plan and sensitivity |
| 14 | Current raise and use of funds | Amount, runway, milestone outcomes, clear next step |

Appendix: market model, competitor profiles, AI evaluation, product availability, cohort definitions, revenue assumptions, content arrangements. Keep detailed stack diagrams here unless technology is central to the investor's diligence.

### Competitor analysis — approximately 15 slides plus profiles

Audience: founders, product team, strategic partners; summarized version can support investor diligence.

1. Decision being informed and initial customer.
2. Scope, date, method, and availability legend.
3. Customer tasks and existing alternatives.
4. Fashion competitive landscape, with defined categories.
5. Art competitive landscape, with distinct audiences.
6. Core overlap: PI, Common Objective, FashionUnited, BoF.
7. Discovery and community substitutes.
8. Publishing, identity, and hiring alternatives.
9. Professional intelligence and forecasting alternatives.
10. Sourcing and transaction platforms.
11. Evidence matrix, including Centoire today versus roadmap.
12. Access and pricing, showing geography and tier differences.
13. Differentiation hypotheses and counterarguments.
14. Build / partner / defer implications.
15. Validation experiments and decision criteria.

Put lengthy individual comparisons and source details in appendices. Conclude with strategic choices and evidence gaps, not “we win everything.”

## 10. Shared presentation design system

Source of truth: `ui/src/index.css`, current marketing sections, and app navigation. The CSS retains an older Fraunces/Archivo + crimson/gold system, while newer surfaces use the system below. Use the newer editorial system consistently across all decks.

| Role | Font/color | Treatment |
| --- | --- | --- |
| Headings | Playfair Display | 32–40 pt; 48–60 pt covers; selective italics |
| Body, tables, numbers | Plus Jakarta Sans | 18–24 pt body; 14–16 pt compact data; static weights for export reliability |
| Occasional feature quote | Instrument Serif | Optional accent, not a third default body style |
| Primary ink | `#111111` charcoal | Titles, labels, key numbers |
| Secondary text | `#555552` stone | Supporting copy |
| Primary background | `#FBF9F6` sand | Main content slides |
| Secondary background | `#FAF6F2` warm sand / `#F5EFEB` deep sand | Section blocks and tables |
| Accent | `#FF746D` coral | Highlights, chart emphasis, small markers |
| Secondary accent | `#C59A6F` ochre / `#F3D7CB` blush | Limited chart or panel use |
| Rules | `#EBE6E1` hairline | Dividers |

Use the existing vector wordmarks in `ui/src/assets/landing/logo-dark.svg` and `logo-light.svg`; do not recreate the logo with a font. Confirm image rights for external distribution before reusing photography from the repository.

Set a 16:9 master, approximately 0.6-inch outer margins, consistent column grid, page number, version date, and source footer. Aim for one claim and one supporting visual per slide. Keep longer methods in speaker notes. Use 10–12 pt footnotes only for compact source references, with complete readable citations in notes/appendix.

Give the product deck more real UI and creative work, the pitch deck fewer stronger claims and charts, and the competitor deck denser but readable tables. All three share fonts, color roles, spacing, and title treatment. Replace the pitch draft's blue gradient styling and competitor draft's orange/outlined headings with these masters.

Use charcoal text on coral fills. Avoid coral as small body text on sand and white small text on coral; verify contrast in exported files. Charts need direct labels and patterns or symbols where helpful, so color is not the only distinction. Do not use decorative stock charts as business evidence.

Final formats: editable PowerPoint, PDF, source/assumption workbook, and speaker notes. Test imported/exported PowerPoint in both PowerPoint and Canva for font substitution, missing imagery, clipping, editable charts, links, and page numbers. Canva font availability and font embedding must be checked during production.

## 11. Execution sequence and deliverables

Indicative effort, dependent on access and participant availability; this is not a promise that primary research can be completed in a few days.

| Stage | Indicative effort | Deliverable and exit condition |
| --- | --- | --- |
| 0. Orientation | Initial pass completed | Both drafts read, code/brand audit, initial sources, this plan |
| 1. Evidence cleanup | 1–2 working days | Claim ledger, current capability sheet, reconciled assumptions; unsupported claims removed or labeled |
| 2. Desk research and competitor tasks | 3–5 working days | Market evidence, 10–12 deep profiles, dated pricing/access records, first sizing model |
| 3. Customer research | 2–3 calendar weeks including recruitment | Interviews, diary study, usability sessions; pain/segment synthesis; sample limitations |
| 4. Business synthesis | 1–2 working days after evidence | Initial market, positioning, paid offer hypothesis, channel model, milestone plan |
| 5. Narrative and design | 3–5 working days | Shared masters, three rewritten storyboards, editable decks with notes and citations |
| 6. Review and export | 1–2 working days | Numerical and factual review, rehearsal, export/font checks, complete source package |

Begin desk research and brand masters while interviews are being arranged. A provisional deck can be produced from public evidence earlier, with explicit gaps. External research cannot substitute for missing traction or founder facts.

Suggested accountable roles: founder/product owner for strategy and company facts; researcher for evidence and competitor work; engineering owner for runtime/data validation; designer for masters and export checks; finance owner/founder for the operating model. These are responsibilities, not assumptions about current staffing.

Final quality criteria:

- Every material number has a source, period, geography, definition, and calculation where relevant.
- Every product claim is labeled accurately for its release state.
- Competitor claims use equivalent tasks and dated evidence, with unknowns visible.
- Market sizing deduplicates customers and separates GMV/influenced spending from obtainable revenue.
- Pricing and forecasts reconcile across all three decks.
- Team, current raise, traction, and partnerships come from verified company facts.
- Every slide has a useful takeaway, readable visual hierarchy, and correct font/color treatment.

## 12. Inputs still required

The plan can proceed with public research, but final presentations need:

- The product presentation draft or its link, if it already exists.
- Confirmed first audience, launch geography, and preferred presentation language.
- Actual registered/active users, activation/retention cohorts, content activity, revenue, and pilot commitments, with dates and definitions; explicitly state where there is no data yet.
- Current production feature availability and ingestion/AI success metrics.
- Team biographies, company/entity facts, founder advantage, current raise amount, budget, and intended runway.
- Actual versus proposed prices, partner permissions, testimonials, and any signed institutional or commercial commitments.
- Investor audience/stage, presentation duration, and target deadline.

Until supplied, keep these as explicit research gaps. Do not fill them with industry averages or fabricated numbers.
