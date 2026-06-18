# ABA.com DXP Design, Implementation & Migration — Content & Technical Due-Diligence Audit

**Prepared for:** RFP response / pre-bid due diligence
**Subject site:** https://www.aba.com (American Bankers Association)
**Source RFP:** *DXP Website Design, Implementation, & Migration* — issued June 15, 2026 (responses due July 21, 2026; ABA contact: Niambi Mack)
**Audit date:** June 18, 2026
**Method:** External reconnaissance of public artifacts (robots.txt, sitemap.xml, rendered navigation, public listing pages, vendor case studies, job postings) cross-referenced against RFP scope. No authenticated crawl or CMS export was available, so volume figures for member-gated/database-driven content are characterized structurally rather than counted. **Confidence is flagged per finding.**

---

## 1. Executive Summary

ABA.com is a large **Sitecore enterprise DXP** whose scale is manufactured by a small number of **templated, database-driven content engines** — not by 97,000 hand-built pages. The site is heavily weighted toward **compliance/regulatory reference content** (the single largest driver), a **deep daily-news archive**, and a **commerce-integrated training/education catalog** synced from an association-management system.

The RFP's own framing is the anchor fact: ABA estimates **"approximately 97,000 pages across about fifteen content types, plus related assets"** must be migrated (RFP §4.6). For a bidder, the central due-diligence conclusions are:

1. **"97,000 pages" is almost certainly a CMS item/asset count, not 97,000 navigable URLs.** The public sitemap exposes on the order of ~1,000 URLs, overwhelmingly compliance. The gap between public pages and 97,000 = templated datasources, member-gated records, and media assets. **This must be clarified before pricing migration** (see §6, §13).
2. **The integration surface is the real risk, not the page count.** The current stack — Sitecore + OneLogin (SSO) + Nimble AMS (CRM/ecommerce) + Cornerstone (LMS) + Higher Logic (community) + Coveo (search) — is explicitly to be preserved with "minimal changes" and **no disruption to ecommerce flow** (RFP §4.1). Re-wiring identity, authorization, and commerce across a platform migration is where the engagement is won or lost.
3. **The "DXP-agnostic" requirement is in tension with a reusable component library.** ABA is selecting in parallel among **Sitecore AI, Optimizely SaaS (with Opal), Adobe Experience Manager Sites, and WordPress VIP** (RFP §1, §2). These four have fundamentally different component/templating models. A bid must show how a design system and migration approach survive that uncertainty — and price the cost deltas per platform (RFP explicitly asks for this).
4. **High-authority SEO is concentrated in the compliance/regulatory pages.** These rank well and drive organic discovery; SEO/redirect preservation at 97k scale is a named deliverable (RFP §4.6) and a material risk.

The remainder of this document inventories the architecture, reconstructs the ~15 content types, deconstructs the page count, assesses migration complexity, maps findings to the RFP's evaluation criteria, and lists the clarifying questions to submit before the **June 26 questions deadline**.

---

## 2. RFP Context (what is actually being procured)

| Element | Detail |
|---|---|
| Engagement | Design + implementation + **migration** of ABA.com onto a newly selected DXP |
| Platform | Chosen in a **parallel** RFP among **Sitecore AI, Optimizely SaaS + Opal, AEM Sites, WordPress VIP**; bid must be **DXP-agnostic** with per-platform cost deltas |
| Migration scope | **~97,000 pages, ~15 content types, plus related assets**; automated **and** manual migration must be **separate line items** |
| Personalization | CRM/CDP-informed; **member vs non-member** distinction is central; phased (rules-based → AI-matured) |
| Integrations to preserve | OneLogin (SSO), Nimble AMS (CRM/ecommerce), Cornerstone OnDemand (LMS), Higher Logic (community), Coveo (search) — *minimize changes, protect ecommerce flow* |
| Accessibility | **WCAG 2.2 Level AA**; Critical/Serious violations remediated pre-launch |
| Hosting | 99.9% uptime; ≥5 environment tiers (prod, support, UAT, project, local); DR/backup |
| Commercials | **5-year TCO**; ongoing support/maintenance contracted separately |
| Response limit | 15 pages (excl. title, ToC, pricing, resumes, appendices, references) |

**Evaluation weighting (RFP §7):**

| Criterion | Weight |
|---|---|
| DXP / UX / IA / Content Strategy approach & expertise | 20% |
| **Migration expertise & flexibility** | 20% |
| CDP integration & personalization strategy | 20% |
| Technical execution incl. testing | 15% |
| Cost | 15% |
| Team & experience | 10% |

> **Implication:** 40% of the score sits on migration + CDP/personalization. The content audit (this document) underpins both. Migration cannot be priced credibly without resolving the page-count ambiguity in §6.

---

## 3. Current-State Technical Architecture

**Confidence: High** (named in RFP §4.1 and corroborated by vendor case study + robots.txt fingerprints).

| Layer | System | Evidence | Migration implication |
|---|---|---|---|
| CMS / DXP (current) | **Sitecore** | RFP §4.1; robots.txt blocks `/sitecore/`, `/-/media/`, `*.axd` | Source schema for content extraction; item tree ≠ page count |
| Search | **Coveo** | RFP §4.1; robots.txt Coveo template param | Every listing/index page is Coveo-driven (see §5); reindex + relevancy parity is a workstream; RFP hints at GenAI search |
| SSO / authentication | **OneLogin** | RFP §4.1; Velir case study | Gating logic must be re-implemented; member-only content depends on it |
| CRM / ecommerce | **Nimble AMS** (Salesforce-based) | RFP §4.1; Velir + Nimble case studies | Product/course pages sync from Nimble; "do not disrupt ecommerce flow" |
| LMS | **Cornerstone OnDemand** (`aba.csod.com`) | RFP §4.1; certification pages | Deep links, transcripts, CE tracking |
| Community | **Higher Logic** | RFP §4.1 | Powers Communities/Exchanges; identity-linked |
| Ecommerce consolidation | Unified cart on Sitecore + Nimble | Velir case study | Prior consolidation of multiple shopping carts — fragile, protect it |
| Prior SI | **Velir** (Platinum Sitecore partner) | Velir case study | Incumbent context; current build conventions |
| Personas vendor | "current marketing optimization and personalization vendor" (unnamed) | RFP §4.1 | Personas already partially defined — collaborate, don't restart |

**Architectural read:** This is a classic enterprise "DXP + AMS + LMS + community + federated search" topology common to large trade associations. The website is the **presentation/orchestration layer** over systems of record (Nimble = members/commerce; Cornerstone = learning; Higher Logic = community). The migration moves the presentation layer while keeping the systems of record — meaning **the integration contracts (APIs, identity, sync jobs) are the load-bearing walls.**

---

## 4. Information Architecture

**Confidence: High** (rendered navigation).

Seven top-level sections, each a deep sub-tree:

1. **Topics** (`/banking-topics/`) — Compliance · Risk Management · Consumer Banking · Payments · Commercial Banking · Technology · Wealth Management · Marketing & Communications · Leadership & Operations
2. **Training & Events** (`/training-events/`) — Conferences · Online Training · Certifications · Schools · Textbooks · Career/Workforce · LMS
3. **Experts & Peers** (`/experts-peers/`) — Experts on Call · Communities (~13) · Committees & Councils (~60+) · Partner Network Directory · Job Board · Speakers Bureau
4. **News & Research** (`/news-research/`) — All News · Analysis & Guides · Economic Research · Email Bulletins (16+) · Podcasts · ABA Banking Journal
5. **Advocacy** (`/advocacy/`) — What We Stand For · Our Issues (30+) · Policy Analysis/Comment Letters · State Alliance · Political Engagement (BankPac) · Community Programs
6. **About Us** (`/about-us/`) — Our Story/Subsidiaries · ABA Foundation · Leadership · Press Room · Careers
7. **Membership** (`/membership/`) — Join · By bank type (Community, Ag, Mutual, De Novo) · Member Savings · Partner Network

**IA pattern (critical for migration):** Almost every section follows a **Hub → Coveo-powered filterable listing → templated detail page** pattern. The hubs and listings are JS/Coveo-rendered (their item counts are not in static HTML — confirmed during this audit, where listing pages returned filters/pagination but no items). This means:
- **Detail pages** are high-volume, schema-consistent → automation candidates.
- **Hubs/listings** are low-volume, bespoke, component-rich → manual/redesign candidates.
- **Search/taxonomy is the connective tissue** — the RFP's emphasis on taxonomy, tagging, and Coveo/GenAI coordination (§4.2) is therefore central, not cosmetic.

---

## 5. Content-Type Inventory (reconstructing the "~15 content types")

**Confidence: Medium** — ABA states "about fifteen content types" (RFP §4.6) but does not enumerate them. The table below is a **defensible reconstruction** from the IA and must be validated against ABA's CMS export. Each row notes the likely **migration treatment** (Automated / Manual / Hybrid) and the **integration dependency** that complicates it.

| # | Content type | Location (example) | Pattern | Likely migration | Key dependency / risk |
|---|---|---|---|---|---|
| 1 | **Compliance topic / reference pages** | `/banking-topics/compliance/...` | Curated + composed | Hybrid | Heavy internal linking; high SEO value |
| 2 | **Regulatory proposals (tracker)** | `/banking-topics/compliance/regulatory-proposals/` | DB detail (700+ in sitemap) | Automated | Schema mapping; agency/topic taxonomy |
| 3 | **Staff analyses** | `/banking-topics/compliance/staff-analysis/` | DB detail | Automated | Linked from charts + topic pages |
| 4 | **"From the Hotline" Q&A** | `/banking-topics/compliance/from-the-hotline/` | DB detail, **member-gated** | Automated | OneLogin gating must be reproduced |
| 5 | **Regulatory charts / Acts & Regulations** | `/banking-topics/compliance/acts/` | Structured reference | Hybrid | Cross-reference integrity |
| 6 | **News articles (Newsbytes / journal / magazines)** | `/news-research/...`, aggregated in `/all-news` | DB detail, high volume | Automated | Multi-source aggregation; feeds |
| 7 | **Press releases** | `/about-us/press-room/press-releases` | DB detail, archive | Automated | Date archive depth; redirects |
| 8 | **Blog posts (ABA Viewpoint)** | aggregated in All News | DB detail | Automated | Author/tag taxonomy |
| 9 | **Advocacy comment letters / policy analysis** | `/advocacy/policy-analysis/` | DB detail + `/archives` | Automated | Attached PDFs; archive handling |
| 10 | **Advocacy issue pages ("Our Issues")** | `/advocacy/our-issues` (30+) | Curated landing | Manual | Editorial, campaign-linked |
| 11 | **Training / online courses** | `/training-events/online-training/` | **Ecommerce product**, Nimble-synced | Hybrid | **Do not break commerce**; sync jobs |
| 12 | **Certifications / Schools / Conferences & events** | `/training-events/...` | **Ecommerce product**, Nimble-synced | Hybrid | Cart, pricing, member rates, Cornerstone |
| 13 | **Committees / Councils / Communities** | `/experts-peers/...` (~60+ / ~13) | Directory + community | Hybrid | Higher Logic integration; gating |
| 14 | **Email-bulletin & podcast landing pages** | `/news-research/email-bulletins`, `/podcasts` | Landing + episode detail | Hybrid | Subscription/ESP integration; media |
| 15 | **Member tools / Partner Network directory / endorsed providers** | `/experts-peers/partner-network/directory`, `/membership` | Directory detail | Hybrid | Partner data source; member gating |
| — | **"Related assets" (not a page type)** | `/-/media/documents/`, `/-/media/archives/` | PDFs, images, archives | Asset migration | Re-linking at scale; robots-blocked today |

> **Bidder note:** Items 11–15 carry **integration dependencies** that make "automated migration" misleading — the *content body* may migrate programmatically, but the *functional wiring* (cart, gating, community, LMS deep-links) is manual integration work. Price these as integration, not content migration.

---

## 6. Deconstructing "97,000 Pages"

**Confidence: Medium-High on the reasoning; the exact composition requires ABA confirmation.**

Three distinct things are routinely conflated under "pages." The 97,000 must be decomposed before it can be priced:

| Definition | What it counts | Evidence for ABA | Order of magnitude |
|---|---|---|---|
| **Navigable HTML pages** | Unique user-facing URLs | Public `sitemap.xml` exposes ~1,000, dominated by compliance; much is `Disallow`-ed | Low thousands (public) + gated set |
| **CMS content items** | Every Sitecore tree node: pages **+ component datasources + folders + data items** | Sitecore architecture; one rendered page = many items | **Most likely source of "97,000"** |
| **Media assets** | PDFs, images, archived docs under `/-/media/` | robots.txt blocks large media trees; RFP says "plus related assets" | Thousands (counted separately per RFP) |

**Why a Sitecore item count balloons:** In Sitecore, a single article page can comprise a page item plus multiple datasource items (hero, callouts, related-content lists, promos), all of which are countable "items." A site with ~10–15k real pages can easily present ~97k items. The RFP wording — "97,000 pages across about fifteen content types, **plus related assets**" — implies assets are *additional*, which points toward 97,000 being a **content-item** figure.

**Why this matters for the bid:**
- **Automated vs manual line items (RFP §4.6/§8 Pricing) hinge on this.** Migrating 97k *items* with consistent schemas is a scripting exercise; migrating 97k bespoke *pages* manually is a different order of cost.
- A large fraction is plausibly **archive/retire candidates.** The RFP explicitly wants rationalization ("retain, consolidate, remove" — §4.6). A realistic bid assumes **the migrated set is materially smaller than 97k** after rationalization and says so.
- **Action:** Do not price migration off 97,000 until ABA provides the item-type breakdown (see Question Q1, §13). Offer a rationalization-first phase that converts 97k gross into a net migratable inventory.

---

## 7. Migration Complexity & Risk Assessment

**Automated-migration candidates (high volume, consistent schema):** regulatory proposals, staff analyses, news/Newsbytes, press releases, comment letters, hotline Q&A bodies, blog posts. → Field-mapped, scripted, validated in bulk.

**Manual-migration / redesign candidates (low volume, high bespoke value):** homepage, section hubs, "Our Issues" landing pages, membership/marketing/campaign pages, richly-composed topic pages, anything with bespoke component layouts or personalization targeting.

**Hybrid / integration-heavy (body automated, wiring manual):** all ecommerce product pages (training, certifications, schools, conferences), community pages (Higher Logic), LMS-linked pages (Cornerstone), partner directory, gated member content.

### Top migration risks

| # | Risk | Why it matters | Mitigation to propose |
|---|---|---|---|
| R1 | **Page-count ambiguity** | Can't price auto vs manual credibly | Rationalization/inventory phase up front; clarifying Q1 |
| R2 | **Ecommerce continuity** | RFP: minimize changes, protect flow | Keep Nimble sync contract; parallel-run cart; freeze-and-verify |
| R3 | **Identity/authorization re-wire** | Member gating depends on OneLogin + Nimble | Re-implement gating early; test member/non-member matrix |
| R4 | **Search parity (Coveo → ?)** | Every listing is Coveo-driven; possible GenAI shift | Index mapping + relevancy regression suite; decide Coveo stay/replace |
| R5 | **SEO equity loss** | High-authority compliance/regulatory pages rank well | Full redirect map; preserve URLs/metadata; pre/post crawl diff |
| R6 | **Asset re-linking at scale** | Thousands of `/-/media/` PDFs referenced inline | Automated link-rewrite + broken-link audit |
| R7 | **DXP-agnostic component model** | Sitecore/Optimizely/AEM/WP VIP differ structurally | Platform-neutral design tokens; isolate platform-specific layer; price deltas |
| R8 | **Higher Logic / Cornerstone deep links** | Community + learning journeys cross domains | Preserve link contracts; SSO continuity testing |
| R9 | **Personalization cold-start** | Member vs non-member rules must be live at launch (RFP §4.4) | Rules-based phase 1 using existing personas; CDP identity resolution design |
| R10 | **Content freeze window** | 97k moving target during cutover | Delta-sync strategy; editorial freeze plan |

---

## 8. Web Ecosystem / Cross-Property Considerations

**Confidence: Medium.** The RFP repeatedly references "ABA's web properties" and "cross-property discovery," signaling this is **not a single-domain** engagement in spirit even if aba.com is the core.

Known/likely properties and entities:
- **aba.com** — core Sitecore DXP (in scope).
- **bankingjournal.aba.com** — ABA Banking Journal (since 1908); appears to run on a **separate (WordPress-style) platform** → likely **not** counted in the 97k Sitecore total; confirm scope.
- **Subsidiaries/affiliates** — ABA Foundation (Community Engagement Foundation), ABA Securities Association, Corporation for American Banking; some may have their own pages/sites.
- **BankPac / political engagement**, microsites, mobile apps (ABA's terms reference "microsites" and "mobile applications").

**Bidder action:** Clarify which properties are in launch scope vs future phases (RFP's "some platforms and systems may remain separate"). Cross-property discovery likely means **unified taxonomy + federated search**, not necessarily co-migration.

---

## 9. DXP Platform Lens (agnostic, per RFP)

The bid must work across four platforms with materially different models. Summary of what changes per platform:

| Platform | Content model | Migration consideration | Likely cost-delta driver |
|---|---|---|---|
| **Sitecore (AI/XM Cloud)** | Item tree, components/datasources | **Lowest delta — incumbent**; same-platform or XM Cloud uplift; existing build conventions | Lowest migration; re-platform to cloud effort |
| **Optimizely SaaS + Opal** | Block/content-graph, SaaS CMS | Re-model content into blocks; different personalization engine | Re-templating + personalization rebuild |
| **AEM Sites** | Components + Content Fragments, JCR | Heaviest enterprise re-architecture; DAM migration | Highest implementation + licensing |
| **WordPress VIP** | Posts/CPTs, blocks (Gutenberg) | Simplest model but custom-post-type modeling for 15 types; enterprise governance | Custom development for AMS/commerce depth |

**Strategic note for the response:** Lead with a **platform-neutral layer** (IA, taxonomy, design tokens, content schemas, migration tooling) and isolate a thin **platform-specific implementation layer**. State experience per platform explicitly (RFP requires it) and provide the cost delta table. The incumbent Sitecore path is the lowest-risk migration; the others are partial rebuilds — say so.

---

## 10. CDP & Personalization (20% of score)

- **Member vs non-member** is the primary axis (RFP §4.4) — drives content access, CTAs, pricing visibility, and journeys. This identity already exists in **Nimble (authorization)** + **OneLogin (authentication)**; CDP must resolve identity across these plus LMS/community.
- **Phased approach expected:** rules-based segmentation at launch → AI-matured later. Personas are **already partially defined** by ABA's existing personalization vendor — collaborate, don't restart.
- **CDP choice is open:** native DXP CDP vs existing tooling. Design identity resolution, profile unification, and downstream measurement with documented data sources (RFP Key Deliverables).
- **At launch, segmentation/personalization/journey triggers must be live** (RFP §4.4) — not a post-launch add. This is a schedule risk; sequence persona/data work into discovery.

---

## 11. SEO, Accessibility & Quality Gates

- **SEO (RFP §4.6):** Preserve URLs, metadata, redirects. The compliance/regulatory corpus is the organic-traffic crown jewel — protect it with a complete redirect map and pre/post-launch crawl diffing. Recommend a baseline crawl + Search Console export during discovery.
- **Accessibility (RFP §4.3):** WCAG **2.2 AA**; a **third-party accessibility vendor** identifies Critical/Serious violations that must be fixed pre-launch. Bake accessibility into the component library (design-system level), not retrofitted per page.
- **QA/UAT (Key Deliverables):** Vendor QAs against all requirements before ABA UAT; must run UAT readiness/feedback/retest process. Plan a content-parity QA at 97k scale (automated diffing).

---

## 12. Mapping This Audit → RFP Response Sections

| RFP response section | How this audit feeds it |
|---|---|
| Executive Summary | §1 understanding of objectives + page-count insight as differentiator |
| Project Approach §4 | §5–§11 give the substance for discovery, IA/taxonomy, migration, CDP, hosting |
| **Migration approach (20%)** | §5 content-type → treatment table; §6 page-count deconstruction; §7 risks; auto/manual line-item logic |
| **CDP/personalization (20%)** | §10 member/non-member model, phased approach, identity resolution |
| IA/UX/Content Strategy (20%) | §4 IA + §5 taxonomy/content types |
| Technical & Integration | §3 integration map; §9 platform lens; R-series risks |
| Relevant Experience | Emphasize Sitecore + AMS/LMS + large-scale migration + association/financial-services |
| Pricing (5-yr TCO) | §6/§7 to justify auto vs manual split + rationalization phase |
| Assumptions & Dependencies | §13 questions become stated assumptions if unanswered |

---

## 13. Clarifying Questions to Submit (before June 26 deadline)

**Highest priority (block pricing):**
1. **How is "97,000 pages" counted** — navigable URLs, Sitecore content items, or items + assets? Please provide a **breakdown by content type and by public vs member-gated**.
2. Of the 97,000, what share are **active vs archive/retirement candidates**? Is there a target net-migrated volume after rationalization?
3. Please confirm the **list of the ~15 content types** and approximate volume per type.
4. **Asset volume:** how many media assets (PDFs/images) under `/-/media/`, and are they in migration scope?

**Integration & platform:**
5. Confirm that **OneLogin, Nimble AMS, Cornerstone, Higher Logic** remain as-is with no re-platforming during this engagement.
6. **Coveo:** is search staying on Coveo, replaced by native DXP search, or moving to GenAI search? Who owns relevancy parity?
7. Is the **DXP platform decision expected before kickoff** (Sept 8), or must implementation begin platform-agnostic?
8. Which **CDP** is intended — native DXP CDP or an existing/separate CDP?
9. Who is the **current personalization/persona vendor**, and what persona artifacts will be provided?

**Scope & SEO:**
10. Are **bankingjournal.aba.com** and other properties/subsidiaries in launch scope or future phases?
11. Is there a current **redirect map / SEO baseline / Search Console access** available for discovery?
12. Is the site **English-only**, or is localization in scope?
13. What **content-freeze / editorial-freeze** windows are acceptable during cutover?
14. Confirm the **third-party accessibility vendor** and whether ABA or vendor owns remediation of their findings.

---

## 14. Recommended Next Step: Authoritative Inventory

The single most valuable due-diligence action — and the thing that de-risks the migration line items — is to replace estimates with a real inventory:

1. **CMS export / item report** from ABA's Sitecore (authoritative item count, split: pages vs datasources vs media). This is the ground truth for the 97k.
2. **Authenticated crawl** (e.g., Screaming Frog with member credentials, JS rendering, sitemap + Coveo listings followed) → true **navigable** page count, segmented by section.
3. **Diff the two** → the gap quantifies templated/gated/asset bloat and directly informs the **automated vs manual** cost split.
4. **SEO baseline** (Search Console + analytics top-pages) → protect the high-value compliance corpus in the redirect strategy.

Until these exist, every migration number is an assumption — and the bid should state that explicitly, anchoring price to a **rationalization-first discovery phase**.

---

## 15. Confidence & Limitations

- **High confidence:** technical stack (RFP-named + fingerprinted), IA/navigation, RFP scope/criteria, that the site is Sitecore/Coveo-driven, that listings are dynamic and member-gated.
- **Medium confidence:** the reconstructed 15 content types (validated structurally, not against ABA's actual taxonomy), the interpretation of 97,000 as a CMS-item figure.
- **Not independently verified:** exact per-type volumes, total asset count, and the precise definition of "page" — all require ABA's CMS export or an authenticated crawl. The public sitemap (~1,000 URLs) and robots.txt are the only hard public artifacts; the bulk of the site is non-indexed and/or gated by design.

---

## Sources

- ABA — [homepage](https://www.aba.com/) · [robots.txt](https://www.aba.com/robots.txt) · [sitemap.xml](https://www.aba.com/sitemap.xml) · [About / Subsidiaries](https://www.aba.com/about-us/our-story/subsidiaries)
- Compliance engines — [Regulatory Proposals](https://www.aba.com/banking-topics/compliance/regulatory-proposals) · [Staff Analysis](https://www.aba.com/banking-topics/compliance/staff-analysis) · [From the Hotline](https://www.aba.com/banking-topics/compliance/from-the-hotline)
- News — [News & Research](https://www.aba.com/news-research) · [All News](https://www.aba.com/news-research/all-news) · [Banking Journal](https://www.aba.com/news-research/banking-journal) · [bankingjournal.aba.com](https://bankingjournal.aba.com/) · [Daily Newsbytes](https://www.aba.com/news-research/email-bulletins/daily-newsbytes)
- Training/commerce — [Training & Events](https://www.aba.com/training-events) · [Online Training](https://www.aba.com/training-events/online-training) · [Certifications](https://www.aba.com/training-events/certifications) · [LMS (Cornerstone)](https://www.aba.com/training-events/learning-management-system)
- Peers — [Experts & Peers](https://www.aba.com/experts-peers) · [Partner Network Directory](https://www.aba.com/experts-peers/partner-network/directory)
- Advocacy — [Policy Analysis](https://www.aba.com/advocacy/policy-analysis)
- Vendor/stack — [Velir ABA case study (Sitecore + Nimble AMS + OneLogin ecommerce)](https://www.velir.com/work/case-studies/american-bankers-association) · [Nimble AMS ABA story](https://www.nimbleams.com/resources/case-studies/american-bankers-association/) · [Cornerstone OnDemand ABA case study](https://www.cornerstoneondemand.com/resources/article/aba-case-study/)
- Org — [VP, Enterprise Web Strategy & Analytics posting (web governance / platform migration / personalization)](https://www.theladders.com/job/vp-enterprise-web-strategy-analytics-american-bankers-association-washington-dc_86796505)
- Primary — *ABA DXP Website Design, Implementation, & Migration RFP*, issued June 15, 2026 (provided by client)
