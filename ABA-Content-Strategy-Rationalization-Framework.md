# ABA.com Content Strategy, Rationalization & Future-State IA Framework

**Companion to:** *ABA.com DXP Design, Implementation & Migration — Due-Diligence Audit*
**Purpose:** A repeatable, defensible framework ABA (and the implementation partner) can use to (a) inventory and score ~97,000 content items, (b) decide **Keep / Revise / Consolidate / Replace / Remove / Archive**, (c) tie each decision to an **automated or manual** migration method (the RFP's required cost split), and (d) migrate onto a **future-state information architecture** built for search, personalization, and cross-property discovery.
**Date:** June 18, 2026
**Status:** Framework / methodology. Volumes are estimates pending ABA's CMS export + authenticated crawl (see audit §14).

---

## 0. How this connects to the RFP

| RFP requirement | Where this framework answers it |
|---|---|
| §4.6 "Audit and classify content; rationalize (retain, consolidate, remove)" | §2 inventory model · §3 scoring · §4 disposition |
| §4.6 separate **automated vs manual** migration line items | §5 disposition → migration-method mapping |
| §4.2 "flexible, easy-to-maintain taxonomy and tagging model" | §7 taxonomy + §8 metadata schema |
| §4.2 IA redesign for search, personalization, cross-property | §6 future-state IA |
| §4.4 member vs non-member personalization | §6.4 access model + §8 metadata `accessLevel` |
| Key Deliverable: Governance framework | §9 governance + content lifecycle |
| §4.6 preserve SEO & metadata | §5.4 redirect/SEO rules per disposition |

---

## 1. Content Strategy: Principles

Six principles that drive every downstream decision. These become the tie-breakers when a disposition is ambiguous.

1. **Audience-first, not org-chart-first.** Structure content around what bankers, executives, compliance officers, members, non-members, press, and consumers are trying to *do* — not around ABA's internal departments.
2. **Single source of truth.** One canonical page per concept. Duplicate/near-duplicate content is consolidated, not migrated in parallel.
3. **Right-size the corpus before moving it.** Migrating less, better, is cheaper and ranks better than lifting-and-shifting 97k items. Rationalization is a cost-reduction lever, not overhead.
4. **Taxonomy is infrastructure.** Tagging powers search, personalization, cross-property discovery, and AI guardrails simultaneously. It is built once, centrally, and governed.
5. **Member value must be legible.** Every item declares its access level and audience so personalization (member vs non-member) works at launch, not later.
6. **Accuracy is non-negotiable for compliance content.** Regulatory/compliance pages carry legal/operational risk; "outdated" here is a defect, not just low value. Accuracy gates trump traffic.

---

## 2. Content Inventory Model

Before scoring, every item gets a normalized inventory record. This is the spreadsheet/database backbone (one row per content item).

| Field | Source | Used for |
|---|---|---|
| URL / item ID | Crawl + Sitecore export | Identity, redirects |
| Title | CMS | Dedup, review |
| Content type (1 of ~15) | CMS template | Bulk disposition rules |
| Owner / department | CMS / SME | Review routing |
| Publish date / last-modified | CMS | Freshness scoring |
| Access level (public / member / gated) | Auth config | Personalization, migration method |
| 12-mo pageviews / unique visitors | Analytics | Value scoring |
| Organic entrances / ranking keywords | Search Console | SEO value, redirect priority |
| Conversions / revenue attribution | Nimble / analytics | Commercial value |
| Inlinks (internal) | Crawl | Consolidation impact, orphan detection |
| Backlinks (external authority) | SEO tool | SEO value, redirect priority |
| Duplicate/similarity cluster ID | Content-similarity scan | Consolidation |
| Accessibility issues | A11y scan | Remediation cost |
| Attached assets (PDFs/media) | Crawl | Asset migration scope |
| Compliance-sensitivity flag | Taxonomy/SME | Accuracy gate |

> **Build note:** Items 11–15 from the audit (commerce/community/LMS-linked) should be inventoried with their **integration dependency** flagged, because their migration method is "manual integration" regardless of disposition.

---

## 3. Scoring Model (ROT + Value)

Two scores per item, each 0–100. Combine the classic **ROT** (Redundant, Outdated, Trivial) lens with a positive **Value** lens.

### 3.1 Value Score (V) — weighted

| Signal | Weight | Notes |
|---|---|---|
| Traffic & engagement (pageviews, time, scroll) | 20% | Normalized by content type (a hotline Q&A ≠ homepage) |
| SEO authority (organic entrances, ranked keywords, backlinks) | 20% | Protects the compliance/regulatory crown jewels |
| Commercial value (conversions, revenue, lead-gen) | 20% | Training, certifications, membership, events |
| Strategic / advocacy value (mission-critical even if low-traffic) | 15% | Comment letters, issue pages, foundation |
| Uniqueness (only source of this info) | 15% | Member-exclusive value |
| Member value (member-gated, high member use) | 10% | Supports the value proposition |

### 3.2 ROT / Liability Score (L) — weighted

| Signal | Weight | Notes |
|---|---|---|
| Outdated / inaccurate (esp. compliance) | 35% | **Hard gate** for compliance content — see §3.3 |
| Redundant / duplicative (similarity cluster) | 25% | Drives consolidation |
| Trivial / thin / low-purpose | 20% | Stub pages, empty landing pages |
| Maintenance & accessibility debt | 10% | WCAG 2.2 AA remediation cost |
| Orphaned (no inlinks, no traffic) | 10% | Candidate for removal |

### 3.3 Compliance accuracy gate (override)

Any item flagged **compliance-sensitive** that is **outdated/superseded** is routed to **Revise or Remove regardless of its Value score** — high traffic does not justify keeping inaccurate regulatory guidance live. SME sign-off required before a compliance item is dispositioned KEEP.

---

## 4. Disposition Model (Keep / Revise / Consolidate / Replace / Remove / Archive)

Six dispositions. Decision is driven by the V/L scores, then refined by the rules below.

```
                 LIABILITY (ROT) →  LOW                 HIGH
   VALUE ↓
   HIGH                            KEEP                 REVISE
                                   (migrate as-is)      (migrate + fix/update)
   MEDIUM                          KEEP / CONSOLIDATE   CONSOLIDATE / REPLACE
   LOW                             ARCHIVE              REMOVE
```

### Disposition definitions

| Disposition | Meaning | Typical trigger | SEO action |
|---|---|---|---|
| **KEEP** | Migrate substantially as-is onto new templates | High V, low L, accurate | Preserve URL or 301 to equivalent |
| **REVISE** | Migrate, then update content/accuracy/accessibility | High V, high L (fixable) | Preserve URL; refresh metadata |
| **CONSOLIDATE** | Merge ≥2 items into one canonical page | Duplicate/similar cluster; thin variants | 301 all variants → canonical |
| **REPLACE** | Rebuild on new components/templates (content survives, structure changes) | Bespoke layouts, hubs, campaign pages, functional pages | Preserve URL; rebuild UI |
| **REMOVE** | Retire; do not migrate | Low V, high L, orphaned, obsolete | 301 to nearest relevant page; 410 if truly dead |
| **ARCHIVE** | Move to archive store, deindex, keep for record | Historical/regulatory record, low live value | `noindex`; archive subdomain/path |

### 4.1 Default dispositions by content type (starting rules, then SME-adjust)

| Content type (audit §5) | Default disposition | Rationale |
|---|---|---|
| Regulatory proposals (DB) | KEEP (bulk) + ARCHIVE superseded | High SEO/strategic value; archive resolved/expired |
| Staff analyses | KEEP / REVISE | Accuracy gate applies |
| From the Hotline Q&A (gated) | KEEP + REMOVE obsolete | Member value; prune superseded answers |
| News / Newsbytes | KEEP recent / ARCHIVE old | Long tail; archive by date threshold (e.g., >3–5 yrs) |
| Press releases | ARCHIVE older / KEEP recent | Record value, low live traffic |
| Blog (Viewpoint) | KEEP / CONSOLIDATE | Merge thin/duplicative posts |
| Comment letters / policy analysis | KEEP + ARCHIVE old | Strategic record |
| "Our Issues" landing pages | REPLACE | Bespoke, campaign-driven → new components |
| Training / online courses | KEEP (commerce) | Nimble-synced; manual integration, not content move |
| Certifications / schools / events | KEEP (commerce) | Same; protect ecommerce flow |
| Committees / councils / communities | KEEP / REPLACE | Higher Logic-linked; rebuild directory UI |
| Email-bulletin / podcast landing + episodes | KEEP / REPLACE | Landing pages rebuilt; episodes kept |
| Member tools / partner directory | KEEP / REPLACE | Directory data kept, UI rebuilt |
| Topic / compliance hub pages | REPLACE | Composed hubs → new component library |
| Homepage & section hubs | REPLACE | Always rebuilt in a redesign |
| Media assets (PDFs/images) | KEEP / ARCHIVE / REMOVE | De-dup, re-link, retire orphans |

---

## 5. Disposition → Migration Method (the RFP's automated vs manual split)

This is the bridge between rationalization and pricing. Each disposition maps to a migration method and a cost bucket.

| Disposition | Migration method | Cost line item |
|---|---|---|
| KEEP (high-volume, consistent schema) | **Automated** — scripted field mapping, bulk transform | **Automated migration** |
| REVISE | **Automated migrate + manual edit** | Automated + manual (editorial) |
| CONSOLIDATE | **Manual** — editorial merge + redirects | **Manual migration** |
| REPLACE | **Manual** — rebuild on new templates | Manual (design/build, not content move) |
| REMOVE | **No migration** — redirect map only | Redirect engineering (minimal) |
| ARCHIVE | **Automated bulk** to archive store | Automated (archive) |
| Commerce/community/LMS-linked (any disposition) | **Manual integration** regardless | Integration (separate from content migration) |

### 5.1 The rationalization dividend

The 97,000 gross figure is not the migration volume. After scoring:
- **Automated KEEP/ARCHIVE/REVISE** → the bulk, low unit cost.
- **Manual CONSOLIDATE/REPLACE** → the expensive minority; rationalization shrinks it.
- **REMOVE** → migrates nothing; pure redirect cost.

> **Pricing posture for the bid:** Propose a **rationalization-first discovery phase** that converts 97k gross → a net migratable inventory with a per-disposition count. Price automated and manual line items *against that net*, not against 97k. State this explicitly as the assumption.

### 5.2 SEO & redirect rules (apply per disposition)

- Build a **complete redirect map** before cutover; 301 for KEEP/REVISE/CONSOLIDATE/REPLACE, 410 for truly dead REMOVE.
- Preserve URLs where possible for high-authority compliance/regulatory pages (audit's crown jewels).
- Pre/post-launch crawl diff + Search Console monitoring; protect top organic entrances first.
- CONSOLIDATE: every merged variant 301s to the canonical; never leave duplicate live.

---

## 6. Future-State Information Architecture

### 6.1 Design goals (from RFP)

Unified branded experience · improved navigation/journeys/search/discoverability · cross-property discovery · member vs non-member personalization · taxonomy that powers search + personalization + AI guardrails.

### 6.2 Proposed primary navigation (audience- & task-oriented)

A refinement of today's 7 sections — keeps recognizable anchors, sharpens task orientation, and adds a personalization overlay rather than more nav.

| Primary nav | Contains | Primary audience/journey |
|---|---|---|
| **Banking Topics** | Compliance, Risk, Payments, Technology, Consumer/Commercial Banking, Wealth — reference + insight, taxonomy-driven | "Help me do my job / stay compliant" |
| **Training & Certification** | Courses, certifications, schools, conferences, LMS — commerce | "Develop me / my staff" |
| **Insights & News** | Journal, Newsbytes, research, podcasts, analysis — one unified newsroom | "Keep me current" |
| **Advocacy** | Issues, comment letters, political engagement, state alliance | "Represent my interests" |
| **Community** | Committees, councils, communities, experts, partner network | "Connect me with peers/experts" |
| **Membership** | Join, benefits, by bank type, member savings | "Show me the value / convert" |
| **About** | Story, leadership, foundation, press, careers | Org/credibility/press |

**Key change:** today's "Topics," "News & Research," and parts of "Experts & Peers" overlap. Future-state collapses the **newsroom** into one cross-publication hub (Insights & News) and one **Community** hub, reducing duplicate landing pages and powering cross-property discovery via shared tags.

### 6.3 The taxonomy backbone (cross-cutting, powers everything)

Navigation is the *surface*; the **taxonomy is the engine**. Every item is tagged on these facets, enabling faceted search, related-content, personalization, and cross-property surfacing — independent of where it lives in the nav tree.

(See §7 for the full taxonomy and §8 for the per-item metadata schema.)

### 6.4 Access / personalization model (member vs non-member)

Three access tiers, declared per item, driving both gating and personalization:

| Tier | Visibility | Personalization behavior |
|---|---|---|
| **Public** | Everyone | SEO-indexed; non-member CTAs (join/learn) |
| **Member-preview** | Snippet public, full gated | "Sign in / join to read" conversion hook |
| **Member-only** | Authenticated members | Role/line-of-business personalized; `noindex` |

Personalization axes at launch (rules-based): **member status × role × line of business × topic interest**. This maps directly to the metadata schema (§8) and the existing personas — no new data model required to go live.

---

## 7. Taxonomy & Tagging Model

A controlled, governed vocabulary. Each facet is a managed list (no free-text tagging). This is the "flexible, easy-to-maintain taxonomy" the RFP asks for and the AI guardrail source.

| Facet | Example values | Powers |
|---|---|---|
| **Topic** (primary) | Compliance, Risk, Payments, Lending, Technology, Wealth, Marketing, Operations… | Nav, search facets, related content |
| **Subtopic** | BSA/AML, Fraud, Cybersecurity, Mortgage, CRA, Real-Time Payments… | Deep search, personalization |
| **Content type** | Article, Q&A, Regulatory proposal, Staff analysis, Comment letter, Course, Event, Certification, Podcast, Press release, Directory entry… | Templates, filters, migration rules |
| **Audience / role** | Compliance officer, Exec/C-suite, Risk manager, Marketer, Lender, Director, Consumer, Press… | Personalization |
| **Line of business / bank type** | Community, Ag, Mutual, De Novo, Commercial, Wealth/Trust… | Personalization, membership |
| **Access level** | Public, Member-preview, Member-only | Gating + personalization |
| **Regulatory body / agency** | CFPB, OCC, FDIC, Federal Reserve, FinCEN… | Compliance filtering |
| **Lifecycle / status** | Active, Superseded, Archived, Proposed, Final | Disposition + freshness |
| **Format** | Web page, PDF, Video, Audio, Course, Interactive | Asset handling |
| **Date / effective date** | — | Sorting, archive thresholds |

**Governance rule:** facet values are added only via the taxonomy owner (§9). Tagging is mandatory on publish for Topic, Content type, Audience, and Access level (the four personalization-critical facets).

---

## 8. Metadata Schema (per content item)

Minimum required metadata for every migrated item — enforced at publish, ingestible as AI guardrails.

```yaml
id:                 # canonical item ID
title:              # required
canonicalUrl:       # required (redirect source list attached)
contentType:        # required — one of the ~15 types
topic:              # required — primary facet
subtopics: []       # optional
audience: []        # required — role(s)
lineOfBusiness: []  # optional
accessLevel:        # required — public | member-preview | member-only
regulatoryBody: []  # conditional — required if compliance-sensitive
lifecycleStatus:    # required — active | superseded | archived | proposed | final
complianceSensitive: bool   # gates accuracy review
publishDate:        # required
lastReviewed:       # required — drives freshness/review cadence
owner:              # required — accountable team/SME
relatedItems: []    # for related-content + cross-property discovery
seo:
  metaTitle:
  metaDescription:
  redirectsFrom: [] # all old URLs 301'ing here
assets: []          # linked PDFs/media (for asset migration)
```

---

## 9. Governance & Content Lifecycle

A scalable operating model (RFP Key Deliverable). Without governance, the rationalized corpus re-bloats within 18 months.

### 9.1 Roles

| Role | Responsibility |
|---|---|
| **Content owner (SME/dept)** | Accuracy, lifecycle status, review cadence for their items |
| **Taxonomy owner (central)** | Maintains controlled vocabularies; approves new facet values |
| **Web/governance team** | Publishing workflow, standards, QA, analytics, optimization |
| **Compliance reviewer** | Sign-off gate for compliance-sensitive content |
| **DXP admin** | Templates, components, personalization rules, integrations |

### 9.2 Lifecycle workflow

```
Draft → SME review → (Compliance sign-off if sensitive) → Tagging/metadata check
      → Accessibility check (WCAG 2.2 AA) → Publish → Scheduled review (by lastReviewed)
      → Revise | Archive | Remove
```

### 9.3 Review cadence (prevents re-bloat)

| Content type | Review trigger |
|---|---|
| Compliance / regulatory | On rule change + annual minimum |
| News / press | No review; auto-archive past date threshold |
| Training / commerce | Synced with Nimble product lifecycle |
| Evergreen topic/hub | Annual |
| Campaign / issue pages | At campaign end |

### 9.4 AI guardrails

The taxonomy (§7), metadata schema (§8), and the component/style + brand guides (RFP Key Deliverables) become the structured inputs that constrain AI-assisted content production and search — "guardrails" the RFP explicitly wants in an AI-ingestible format.

---

## 10. Phased Roadmap (rationalization → migration → optimize)

| Phase | Activities | Output |
|---|---|---|
| **1. Inventory & baseline** | CMS export + authenticated crawl + analytics/SEO merge → master inventory (§2) | Scored inventory of the true item count |
| **2. Score & disposition** | Apply §3 scoring + §4 dispositions; SME/compliance review of edge cases | Per-item KEEP/REVISE/CONSOLIDATE/REPLACE/REMOVE/ARCHIVE + auto/manual counts |
| **3. Future-state IA & taxonomy** | Finalize §6 IA, §7 taxonomy, §8 metadata; URL/redirect map | Validated IA + redirect plan + content models |
| **4. Migrate** | Automated bulk (KEEP/ARCHIVE/REVISE) + manual (CONSOLIDATE/REPLACE) + integration wiring | Migrated content on new DXP |
| **5. Launch & verify** | Redirect verification, SEO crawl diff, A11y gate, UAT | Production launch |
| **6. Govern & optimize** | Stand up §9 governance + review cadence + analytics | Sustained, non-bloating corpus |

> Phases 1–2 are the **rationalization-first discovery** that resolves the 97k ambiguity and produces the automated/manual line-item counts the RFP requires before migration can be priced.

---

## 11. What to confirm with ABA (feeds the disposition rules)

These are decision inputs that change the default dispositions in §4.1:
1. **Archive thresholds** — at what age do news/press releases auto-archive? (e.g., 3 vs 5 years)
2. **Compliance retention** — which regulatory/comment-letter content must be retained as record even when superseded?
3. **Member-only corpus** — what % is gated, and does any gated content need a public preview tier for SEO/conversion?
4. **Commerce scope** — confirm training/cert/event pages migrate as commerce (manual integration), not content move.
5. **Archive destination** — separate archive subdomain/path vs `noindex` in place?
6. **Definition of the ~15 content types** — validate §4.1 mapping against ABA's real templates.

(These align with, and extend, the audit's §13 clarifying questions — submit before the **June 26** RFP question deadline.)

---

## 12. Summary

- **Strategy:** audience-first, single-source-of-truth, rationalize-before-migrate, taxonomy-as-infrastructure, member-value-legible, accuracy-gated compliance.
- **Rationalization:** score every item on **Value** and **ROT/Liability**, then disposition into **Keep / Revise / Consolidate / Replace / Remove / Archive**, with a compliance-accuracy override.
- **Migration link:** each disposition maps to **automated or manual** method — producing the RFP's required cost split *against a net inventory*, not the 97k gross.
- **Future-state IA:** 7 sharpened audience/task-oriented sections over a **cross-cutting taxonomy backbone** and a **three-tier member access model**, with a governed tagging + metadata schema that simultaneously powers search, personalization, and AI guardrails.
- **Governance:** roles + lifecycle + review cadence keep the rationalized corpus from re-bloating.

This framework is the operational answer to RFP §4.2 (UX/Content Strategy), §4.6 (Migration), and the Governance/IA/Measurement Key Deliverables — and it converts the headline "97,000 pages" from a cost liability into a rationalization opportunity.
