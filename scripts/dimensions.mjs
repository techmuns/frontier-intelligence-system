// Stable primitive dimensions (spec §6–§11).
//
// Every company is mapped across SIX INDEPENDENT dimensions. This is not one
// mutually-exclusive tree: a company can be an application, at autonomy level
// 3, selling outcome-based, physical, and depending on six capabilities all at
// once.
//
// Design constraints this file honours:
//   - §6: the labels are SEEDED, not permanent. Everything below is data, not
//     control flow — adding a stack position or capability means adding an
//     entry, never editing logic or a schema.
//   - §5: every inference carries confidence and the evidence that produced it.
//   - §45: when nothing matches, the answer is "unknown", never a guess.
//
// Matching runs over the company's own text. Ordering matters: the first rule
// that matches wins, so more specific patterns are listed before general ones.

/** Text a classifier sees. one_liner is weighted by being repeated — it is the
 *  company's own positioning, and far less noisy than the long description. */
export function classifiableText(company) {
  const one = company.one_liner ?? "";
  const long = company.long_description ?? "";
  return `${one} ${one} ${long}`.toLowerCase();
}

// ---------------------------------------------------------------------------
// DIMENSION A — Value chain / stack position (§6)
// ---------------------------------------------------------------------------
// Ordered most-specific first. `layer` groups these into the World Stack (§30).

// Industry vocabulary, shared by the vertical-application and economic-domain
// rules. Kept as data so adding an industry never means touching logic (§8:
// "do not hardcode the universe of industries" — this is a seed list the
// classifier reads, not a closed taxonomy).
export const INDUSTRY_TERMS = {
  Healthcare: /\b(health\w*|hospital|clinic|patient|medical|doctor|nurse|dental|pharma\w*|biotech|clinical|therapeut\w*|diagnos\w*|ehr|payer)\b/,
  "Financial Services": /\b(bank\w*|fintech|lending|loans?|credit|payments?|treasury|accounting|bookkeep\w*|tax|audit|invoic\w*|underwrit\w*|insur\w*|wealth|trading|capital markets?)\b/,
  Legal: /\b(legal|law firms?|lawyers?|attorney|paralegal|litigation|contracts?|compliance counsel|patent)\b/,
  Manufacturing: /\b(manufactur\w*|factory|factories|industrial|machining|cnc|fabrication|supply chain|procure\w*|shop floor)\b/,
  Logistics: /\b(logistics|freight|shipping|trucking|warehouse|fulfilment|fulfillment|last-?mile|customs|3pl)\b/,
  Construction: /\b(construction|contractors?|building sites?|architecture|engineering firms?|hvac|electrical work|plumbing|takeoffs?)\b/,
  Defense: /\b(defen[cs]e|military|warfight\w*|dod|munitions?|surveillance|counter-?drone|intelligence agenc\w*)\b/,
  Energy: /\b(energy|power grid|utilit\w*|solar|nuclear|fusion|battery|oil|gas|renewable)\b/,
  Agriculture: /\b(agricultur\w*|farm\w*|crop|livestock|cattle|agronom\w*|fish farm)\b/,
  "Real Estate": /\b(real estate|property|properties|landlord|tenant|mortgage|leasing|brokerage)\b/,
  Retail: /\b(retail|e-?commerce|dtc|shopper|merchandis\w*|storefront|brands?|consumer goods)\b/,
  Education: /\b(education|school|universit\w*|student|teacher|learning|tutor\w*|curriculum)\b/,
  Government: /\b(government|public sector|municipal\w*|federal agenc\w*|permits?|civic)\b/,
  "Media & Entertainment": /\b(media|entertainment|film|video production|music|gaming|creators?|advertis\w*)\b/,
  "Human Resources": /\b(recruit\w*|hiring|talent|hr\b|payroll|onboarding|candidates?|applicants?)\b/,
  "Sales & Marketing": /\b(sales|marketing|crm|leads?|outbound|sdr|bdr|pipeline|campaigns?|seo|growth)\b/,
  "Software Engineering": /\b(developers?|engineers?|codebase|coding|software teams?|devops|ci\/?cd|deploys?|pull requests?)\b/,
  "Customer Support": /\b(customer (support|service|success)|helpdesk|tickets?|contact cent(er|re)|call cent(er|re))\b/,
};

const INDUSTRY_ANY = new RegExp(
  Object.values(INDUSTRY_TERMS).map((r) => r.source).join("|"),
  "i",
);

// Horizontal business functions — cross-industry rather than sector-specific.
const HORIZONTAL_ANY =
  /\b(teams?|companies|businesses|enterprises?|organi[sz]ations?|workflows?|productivity|operations|back ?office|documents?|spreadsheets?|meetings?|scheduling|expenses?|procurement|knowledge|onboarding)\b/;

export const STACK_POSITIONS = [
  {
    id: "foundational_supply",
    label: "Foundational Supply",
    layer: "foundational",
    patterns: [/\b(data ?cent(er|re)|semiconductor|chip fab|custom silicon|asic|gpu cluster|power grid|energy storage|nuclear|fusion|networking hardware|inference hardware)\b/],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    layer: "intelligence",
    patterns: [/\b(foundation model|frontier model|post-?training|pre-?training|reasoning model|model optimi[sz]ation|inference optimi[sz]ation|quanti[sz]ation|fine-?tun\w*|reinforcement learning|world model)\b/],
  },
  {
    id: "data",
    label: "Data",
    layer: "data",
    patterns: [/\b(training data|synthetic data|data label\w*|annotation|proprietary data|data extraction|real-?world data|data pipeline|data engineering|datasets?)\b/],
  },
  {
    id: "agent_infrastructure",
    label: "AI / Agent Infrastructure",
    layer: "infrastructure",
    patterns: [/\b(agent (infra\w*|runtime|memory|orchestration|control plane|framework|reliability|observability|payments?|identity|auth\w*))\b/, /\b(eval\w*|guardrails?|sandbox\w*|context (window|engine|layer)|memory layer|orchestration|observability|llm ?ops|prompt manage\w*|vector (db|database)|retrieval|rag)\b/],
  },
  {
    id: "ai_native_operator",
    label: "AI-Native Operator",
    layer: "operators",
    // The company IS the service provider, not a tool sold to one. The
    // giveaway is "AI-native <service>" or offering the service itself
    // rather than software for people who perform it.
    patterns: [
      /\bai-?native\s+\w*\s?(firm|agency|service|services|clinic|practice|insurer|brokerage|bpo|provider|lab|studio)\b/,
      /\bai-?(powered|driven|first)\s+(law firm|accounting firm|agency|clinic|brokerage|insurer)\b/,
      /\b(we (are|run|operate)|becoming) (an?|the) (ai|autonomous|modern) (law firm|accounting firm|agency|firm|clinic|insurer|brokerage)\b/,
      /\breplac\w* (the )?(agency|law firm|accounting firm|bpo|consultanc\w*|service provider)\b/,
      /\bai (law firm|accounting firm|insurance carrier|consultanc\w*|staffing agenc\w*)\b/,
    ],
  },
  {
    id: "vertical_os",
    label: "Vertical Operating System",
    layer: "operating_systems",
    patterns: [
      /\b(operating system|os) for\b/,
      /\b(end-?to-?end|all-?in-?one|single) platform for\b/,
      /\bsystem of record\b/,
      /\bruns? (your|the) entire\b/,
    ],
  },
  {
    id: "physical_intelligence",
    label: "Physical Intelligence Infrastructure",
    layer: "physical_intelligence",
    patterns: [/\b(simulation|sim-?to-?real|world model|physical ai|robot (data|training|evals?|foundation model)|teleoperat\w*|motion capture|physical intelligence)\b/],
  },
  {
    id: "physical_system",
    label: "Physical System / Robotics",
    layer: "physical_systems",
    patterns: [/\b(robot|robots|robotic|humanoid|drone|actuator|gripper|manipulator|autonomous (vehicle|fleet|truck)|hardware|manufactur\w*|factory)\b/],
  },
  {
    id: "vertical_application",
    label: "Vertical Application",
    layer: "applications",
    // Names an industry anywhere in its pitch. Resolved after the more
    // specific layers above, so infrastructure serving an industry is not
    // miscounted as a vertical app.
    patterns: [INDUSTRY_ANY],
  },
  {
    id: "horizontal_application",
    label: "Horizontal Application",
    layer: "applications",
    // Cross-industry: sells to "teams"/"companies" rather than a sector.
    // Last resort — anything commercial that named no industry lands here,
    // which is the correct reading for most general-purpose B2B software.
    patterns: [HORIZONTAL_ANY, /\b(saas|software|platform|app|tool|api|dashboard|automat\w*|assistant|agent)\b/],
  },
];

// ---------------------------------------------------------------------------
// DIMENSION B — Economic unit automated: the autonomy ladder (§7)
// ---------------------------------------------------------------------------
// Ordered HIGHEST FIRST — a company describing itself as an "AI employee" is
// level 4 even though its text also contains "agent".

export const AUTONOMY_LEVELS = [
  {
    level: 6,
    label: "AI-Native Company",
    patterns: [
      /\bai-?native\s+\w*\s?(firm|agency|service|services|clinic|practice|insurer|brokerage|bpo|provider)\b/,
      /\b(we are|becoming) the (firm|agency|provider|carrier)\b/,
      /\breplac\w* the (firm|agency|provider|bpo|consultanc\w*)\b/,
    ],
  },
  {
    level: 5,
    label: "Department / Function",
    patterns: [
      /\b(entire|whole|full) (department|function|back ?office|team)\b/,
      /\bai (department|finance team|sales team|marketing team|back ?office)\b/,
      /\bruns? (your|the) (finance|hr|marketing|sales|accounting|support) (department|function|team|operations)\b/,
    ],
  },
  {
    level: 4,
    label: "Digital Employee",
    patterns: [
      /\bai\s+\w*\s?(employee|worker|engineer|analyst|accountant|recruiter|sdr|bdr|lawyer|paralegal|nurse|doctor|scientist|researcher|assistant manager|associate|rep|agent for hire)\b/,
      /\b(digital|virtual) (employee|worker|labo(u)?r|staff|teammate|colleague)\b/,
      /\bai teammate|forward-?deployed\b/,
      /\bworks? 24\/?7\b/,
      /\breplaces? (a|the|your) (analyst|accountant|recruiter|assistant|engineer|rep)\b/,
    ],
  },
  {
    level: 3,
    label: "Workflow Owner",
    patterns: [
      /\bend-?to-?end\b/,
      /\bowns? the (workflow|process)\b/,
      /\bautomates? the (entire|whole|full)\b/,
      /\bworkflow automation\b/,
      /\bhandles? everything\b/,
      /\bfull(y)? automat\w*\b/,
      /\bfrom .{3,30} to .{3,30}\b/, // "from intake to filing"
    ],
  },
  {
    level: 2,
    label: "Task Agent",
    patterns: [/\b(agents?|agentic|autonomous\w*|automates?|automating|automation|bot)\b/],
  },
  {
    level: 1,
    label: "Copilot",
    patterns: [
      /\b(copilot|co-?pilot|assistant|assists?|augments?|suggestions?|recommends?)\b/,
      /\bhelps? (you|teams?|engineers?|doctors?|companies|businesses|developers?)\b/,
      /\b(faster|easier|10x) for\b/,
    ],
  },
  {
    level: 0,
    label: "Information",
    patterns: [
      /\b(dashboard|analytics|insights?|reporting|monitor\w*|visibility|observability|search|marketplace|directory|benchmark\w*)\b/,
      /\bdata (platform|provider|feed)\b/,
      /\b(infrastructure|infra|api|sdk|platform|database|tooling)\b/,
    ],
  },
];

// ---------------------------------------------------------------------------
// DIMENSION C — Economic domain (§8): the human role and workflow being
// automated. Powers the Digital Labor Map (§32) — "which jobs are becoming
// software".
// ---------------------------------------------------------------------------
// Deliberately roles, not job titles: "the thing a person used to do", which
// is what makes a row of the labour map meaningful. Extensible by adding an
// entry, per §8's "do not hardcode the universe of industries".

export const HUMAN_ROLES = [
  { id: "sdr", label: "Sales Rep / SDR", patterns: [/\b(sdr|bdr|sales rep\w*|outbound|prospect\w*|cold (call|email)|lead gen\w*)\b/] },
  { id: "support_agent", label: "Support Agent", patterns: [/\b(support (agent|rep|team)|helpdesk|customer service|tickets?|contact cent(er|re))\b/] },
  { id: "recruiter", label: "Recruiter", patterns: [/\b(recruit\w*|sourcing candidates?|talent acquisition|screening (candidates?|applicants?)|interview\w*)\b/] },
  { id: "accountant", label: "Accountant / Bookkeeper", patterns: [/\b(accountant|bookkeep\w*|reconcil\w*|ledger|month-?end close|audit\w*|tax prep\w*)\b/] },
  { id: "analyst", label: "Analyst", patterns: [/\b(analyst|analysis|research\w*|due diligence|financial model\w*|underwrit\w*)\b/] },
  { id: "lawyer", label: "Lawyer / Paralegal", patterns: [/\b(lawyer|attorney|paralegal|legal (work|review|research)|contract review|litigation)\b/] },
  { id: "engineer", label: "Software Engineer", patterns: [/\b(software engineer|developers?|coding|codebase|pull requests?|code review|debugging)\b/] },
  { id: "clinician", label: "Clinician", patterns: [/\b(doctor|physician|nurse|clinician|radiologist|diagnos\w*|patient (care|intake))\b/] },
  { id: "medical_coder", label: "Medical Biller / Coder", patterns: [/\b(medical (billing|coder|coding)|claims? (processing|denial)|prior auth\w*|revenue cycle)\b/] },
  { id: "marketer", label: "Marketer", patterns: [/\b(marketer|marketing|campaigns?|content (creation|marketing)|seo|copywrit\w*|ad creative)\b/] },
  { id: "ops_coordinator", label: "Operations Coordinator", patterns: [/\b(operations? (coordinator|manager|team)|scheduling|dispatch\w*|logistics coordinat\w*|back ?office)\b/] },
  { id: "buyer_procurement", label: "Buyer / Procurement", patterns: [/\b(procure\w*|purchasing|sourcing (suppliers?|vendors?)|rfq|rfp|vendor manage\w*)\b/] },
  { id: "inspector", label: "Inspector / QA", patterns: [/\b(inspect\w*|quality (control|assurance|inspection)|defect detect\w*|compliance check)\b/] },
  { id: "warehouse_worker", label: "Warehouse / Picker", patterns: [/\b(warehouse|picking|packing|palleti[sz]\w*|order fulfil\w*|unloading)\b/] },
  { id: "driver", label: "Driver / Operator", patterns: [/\b(driver|driving|haul\w*|autonomous (truck|vehicle)|last-?mile deliver\w*|machine operator)\b/] },
  { id: "field_technician", label: "Field Technician", patterns: [/\b(field (technician|service)|maintenance|repairs?|installation|hvac|electrician|plumb\w*)\b/] },
  { id: "farmer", label: "Farm Worker / Agronomist", patterns: [/\b(farm\w*|agronom\w*|crop scout\w*|harvest\w*|livestock|herd\w*)\b/] },
  { id: "designer", label: "Designer", patterns: [/\b(designer|design (work|assets?)|creative|3d model\w*|cad\b)\b/] },
  { id: "teacher", label: "Teacher / Tutor", patterns: [/\b(teacher|tutor\w*|instructor|grading|curriculum|lesson)\b/] },
  { id: "scientist", label: "Scientist / Researcher", patterns: [/\b(scientist|wetlab|experiments?|assay|drug discovery|protein|molecul\w*)\b/] },
  { id: "trader", label: "Trader / PM", patterns: [/\b(trader|trading (desk|strateg\w*)|portfolio manage\w*|quant\w*|execution)\b/] },
  { id: "insurance_broker", label: "Insurance Broker / Underwriter", patterns: [/\b(broker\w*|underwrit\w*|policy (quote|binding)|claims? adjust\w*)\b/] },
];

// Workflows are the unit below a role — the actual process being automated.
export const WORKFLOWS = [
  { id: "intake", label: "Intake & Triage", patterns: [/\b(intake|triage|routing|qualif\w*|screening)\b/] },
  { id: "document_processing", label: "Document Processing", patterns: [/\b(documents?|paperwork|forms?|pdfs?|extract\w* (data|information)|ocr)\b/] },
  { id: "outreach", label: "Outreach & Follow-up", patterns: [/\b(outreach|follow-?ups?|sequences?|nurtur\w*|reminders?)\b/] },
  { id: "scheduling", label: "Scheduling & Dispatch", patterns: [/\b(schedul\w*|calendar|dispatch\w*|route planning|booking)\b/] },
  { id: "reconciliation", label: "Reconciliation & Close", patterns: [/\b(reconcil\w*|month-?end|close the books|matching (invoices?|transactions?))\b/] },
  { id: "review_approval", label: "Review & Approval", patterns: [/\b(review\w*|approv\w*|sign-?off|verif\w*|audit trail)\b/] },
  { id: "reporting", label: "Reporting", patterns: [/\b(report\w*|dashboards?|filings?|disclosur\w*|compliance report)\b/] },
  { id: "negotiation", label: "Negotiation & Quoting", patterns: [/\b(negotiat\w*|quotes?|quoting|pricing|bids?|proposals?)\b/] },
  { id: "inspection", label: "Inspection & Monitoring", patterns: [/\b(inspect\w*|monitor\w*|detect\w*|surveil\w*|anomal\w*)\b/] },
  { id: "fulfilment", label: "Fulfilment & Delivery", patterns: [/\b(fulfil\w*|deliver\w*|shipping|picking|packing|dispatch)\b/] },
  { id: "onboarding", label: "Onboarding", patterns: [/\b(onboard\w*|kyc|provision\w*|setup|activation)\b/] },
  { id: "research_analysis", label: "Research & Analysis", patterns: [/\b(research\w*|analy[sz]\w*|due diligence|diligence|benchmark\w*)\b/] },
];

// ---------------------------------------------------------------------------
// DIMENSION D — Value capture model (§9). A company may match several.
// ---------------------------------------------------------------------------

export const BUSINESS_MODELS = [
  { id: "ai_native_service", label: "AI-Native Service Provider", patterns: [/\b(ai-?native (firm|agency|service)|we (do|deliver|perform) the (work|service)|done-?for-?you)\b/] },
  { id: "managed_service", label: "Managed Service", patterns: [/\b(managed service|fully managed|we handle|white-?glove|outsourc\w*|bpo)\b/] },
  { id: "outcome_based", label: "Outcome Based", patterns: [/\b(pay (per|for) (outcome|result|success|conversion|resolution)|% of (savings|recovery|revenue)|performance-?based|only pay when)\b/] },
  { id: "transaction", label: "Transaction Based", patterns: [/\b(per transaction|payment (processing|rails?)|take rate|interchange|per booking|per shipment)\b/] },
  { id: "marketplace", label: "Marketplace", patterns: [/\b(marketplace|two-?sided|connects? (buyers?|sellers?)|matching (buyers?|suppliers?))\b/] },
  { id: "hardware", label: "Hardware Sale", patterns: [/\b(hardware|device|sensor|chip|robot|drone|manufactur\w*|we build (the )?(machines?|robots?|devices?))\b/] },
  { id: "haas", label: "Hardware-as-a-Service", patterns: [/\b(robots?-?as-?a-?service|raas|hardware-?as-?a-?service|haas|per (hour|unit) of robot|lease (our|the) (robots?|fleet))\b/] },
  { id: "api", label: "API", patterns: [/\b(api|sdk|developer platform|endpoint|integrat\w* layer)\b/] },
  { id: "data", label: "Data", patterns: [/\b(data (feed|licens\w*|provider|product)|sell (the )?data|datasets? for)\b/] },
  { id: "usage_based", label: "Usage Based", patterns: [/\b(usage-?based|pay-?as-?you-?go|per (call|token|query|request|minute))\b/] },
  { id: "seat_based", label: "Seat Based", patterns: [/\b(per seat|per user|per employee)\b/] },
  {
    id: "subscription",
    label: "Software Subscription",
    // Broad on purpose and listed last: subscription software is the default
    // model in this cohort, so anything software-shaped that matched none of
    // the more specific models above lands here.
    patterns: [/\b(saas|subscription|platform|software|app|tool|dashboard|workspace|copilot|assistant)\b/],
  },
];

// ---------------------------------------------------------------------------
// DIMENSION E — Digital vs physical (§10)
// ---------------------------------------------------------------------------

export const PHYSICAL_RE =
  /\b(robot|robots|robotic|humanoid|drone|actuator|gripper|hardware|device|sensor|manufactur\w*|factory|warehouse|fleet|vehicle|machine|chip|semiconductor|satellite|spacecraft|lab|physical)\b/;

export const PHYSICAL_CAPABILITIES = [
  { id: "sensing", label: "Sensing", patterns: [/\b(sensor|sensing|perception|lidar|radar|camera|computer vision|cv)\b/] },
  { id: "simulation", label: "Simulation", patterns: [/\b(simulat\w*|sim-?to-?real|digital twin)\b/] },
  { id: "world_model", label: "World Model", patterns: [/\b(world model)\b/] },
  { id: "control", label: "Control", patterns: [/\b(control|controller|motion planning|navigation|policy learning)\b/] },
  { id: "actuator", label: "Actuator", patterns: [/\b(actuator|gripper|manipulator|arm|end effector)\b/] },
  { id: "robot", label: "Robot", patterns: [/\b(robot|robots|robotic|humanoid)\b/] },
  { id: "fleet", label: "Autonomous Fleet", patterns: [/\b(fleet|autonomous (vehicle|truck|delivery))\b/] },
  { id: "physical_data", label: "Physical Training Data", patterns: [/\b(real-?world data|teleoperat\w*|motion (capture|data)|demonstration data)\b/] },
];

// ---------------------------------------------------------------------------
// DIMENSION F — Infrastructure dependencies (§11)
// ---------------------------------------------------------------------------
// What a company REQUIRES to operate. This powers second-order whitespace
// (§25): compare aggregate demand for a capability against how many companies
// supply it.

export const CAPABILITIES = [
  { id: "compute", label: "Compute", demand: [/\b(train\w* (our|a|the|large|foundation)|gpu|compute-?intensive|large-?scale training)\b/], supply: [/\b(gpu (cloud|cluster)|compute (platform|provider)|data ?cent(er|re)|inference (infra\w*|provider))\b/] },
  { id: "inference", label: "Inference", demand: [/\b(real-?time (inference|ai)|low-?latency|at scale|high volume|millions of (calls|queries|requests))\b/], supply: [/\b(inference (engine|api|provider|optimi[sz]ation)|serving (layer|infra))\b/] },
  { id: "models", label: "Models", demand: [/\b(built on (gpt|claude|llama|foundation models?)|powered by (llm|gpt|foundation)|fine-?tun\w*|our models? (are|were) trained)\b/], supply: [/\b(foundation model|we train|our model|frontier model)\b/] },
  { id: "data", label: "Data", demand: [/\b(train\w* (our|a|the)|dataset|data-?hungry|fine-?tun\w*|labelled data|labeled data)\b/], supply: [/\b(training data|synthetic data|data label\w*|annotation|datasets? for)\b/] },
  { id: "memory", label: "Memory", demand: [/\b(remembers?|persistent context|across sessions|long-?term context|learns? (from|about) (you|your|each))\b/], supply: [/\b(memory (layer|for agents?|infra)|long-?term memory|context (engine|layer))\b/] },
  { id: "retrieval", label: "Retrieval", demand: [/\b(across (your|their|all) (documents?|data|knowledge)|knowledge base|corpus|cites? sources?)\b/], supply: [/\b(vector (db|database|search)|retrieval|rag (infra|platform)|semantic search)\b/] },
  { id: "identity", label: "Identity", demand: [/\b(on (their|your) behalf|acts? for|impersonat\w*|delegat\w*|verif\w* (identity|itself))\b/], supply: [/\b(identity (for|layer|provider)|authenticat\w*|sso|agent identity|know your agent)\b/] },
  { id: "authorization", label: "Authorization", demand: [/\b(on (their|your) behalf|acts? for|permissions?|access control|approval (flow|chain)|least privilege)\b/], supply: [/\b(authori[sz]ation|permissions? (layer|infra)|access control|rbac|policy engine)\b/] },
  { id: "payments", label: "Payments", demand: [/\b(purchas\w*|checkout|transact\w* on|pays? for|billing|procure\w*|settle\w* funds?)\b/], supply: [/\b(payment (rails?|infra\w*|platform)|agent payments?|wallets?|billing (infra|platform)|stripe for)\b/] },
  { id: "voice", label: "Voice", demand: [/\b(phone calls?|inbound calls?|outbound calls?|speaks? to|voice conversations?|call cent(er|re))\b/], supply: [/\b(voice (ai|agents?|infra\w*|api)|speech|text-?to-?speech|tts|asr|telephony)\b/] },
  { id: "messaging", label: "Communication", demand: [/\b(sends? (emails?|messages?|texts?)|outreach|follow-?ups?|notif\w* (users?|customers?))\b/], supply: [/\b(messaging (infra|api)|email (api|infra)|communications? (api|platform)|sms api)\b/] },
  { id: "browser", label: "Browser Execution", demand: [/\b(browse\w*|web (task|automation)|scrap\w*|fills? (out|in)|navigat\w* (the )?web|clicks? through)\b/], supply: [/\b(browser (infra\w*|automation|agents?)|headless browser|computer use|web automation)\b/] },
  { id: "sandboxing", label: "Sandboxing", demand: [/\b(execut\w* code|runs? code|code interpreter|arbitrary code|untrusted)\b/], supply: [/\b(sandbox\w*|isolated (runtime|environment)|secure execution|code execution (infra|api))\b/] },
  { id: "observability", label: "Observability", demand: [/\b(in production|production-?grade|at scale|debug\w*|trace\w*|root ?cause)\b/], supply: [/\b(observability|monitoring for|tracing|debugging (agents?|llm)|datadog for)\b/] },
  { id: "evals", label: "Evals", demand: [/\b(accura\w*|reliab\w*|hallucinat\w*|correctness|quality (assurance|control)|benchmark\w*)\b/], supply: [/\b(evals?|evaluation (platform|infra|harness)|benchmark\w*|testing (agents?|llm|models?))\b/] },
  { id: "security", label: "Security", demand: [/\b(sensitive (data|information)|pii|confidential|on-?prem|air-?gapped|zero (trust|retention))\b/], supply: [/\b(security (for|platform|layer)|guardrails?|prompt injection|red ?team|threat detection)\b/] },
  { id: "compliance", label: "Compliance", demand: [/\b(regulated|regulatory|hipaa|soc ?2|gdpr|fda|sec |finra|audit trail)\b/], supply: [/\b(compliance (platform|automation|for)|soc ?2|hipaa|audit (automation|platform)|regulatory)\b/] },
  { id: "insurance", label: "Insurance", demand: [/\b(liabilit\w*|indemnif\w*|covers? (damage|loss)|at-?risk|guarantee\w* (the )?(outcome|result))\b/], supply: [/\b(insurance for|insur\w* (product|platform|layer)|underwrit\w*|liability cover\w*)\b/] },
  { id: "human_in_loop", label: "Human-in-the-loop", demand: [/\b(human (review|approval|oversight|expert)|escalat\w*|reviewed by|approval (step|required))\b/], supply: [/\b(human-?in-?the-?loop|human review|expert (review|network)|annotation workforce)\b/] },
  { id: "integration", label: "Enterprise Integration", demand: [/\b(integrates? with|plugs? into|existing (systems?|tools?|stack)|legacy (systems?|software)|works? with your)\b/], supply: [/\b(integrat\w* (platform|layer|infra)|connectors?|unified api|middleware|ipaas)\b/] },
  { id: "robotics_hardware", label: "Robotics Hardware", demand: [/\b(deploys? robots?|robot fleet|our robots?|physical automation|picks? and places?)\b/], supply: [/\b(robot (hardware|platform|parts?)|actuator|gripper|manufactur\w* robots?)\b/] },
  { id: "energy", label: "Energy", demand: [/\b(data ?cent(er|re)|training runs?|electrif\w*|power-?hungry|megawatts?)\b/], supply: [/\b(energy|power|grid|battery|solar|nuclear|fusion|electricity)\b/] },
];

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** First rule whose pattern matches, with the matched text kept as evidence. */
function firstMatch(rules, text) {
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const m = text.match(pattern);
      if (m) return { rule, evidence: m[0] };
    }
  }
  return null;
}

/** Every rule that matches, each with its own evidence. */
function allMatches(rules, text) {
  const out = [];
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const m = text.match(pattern);
      if (m) {
        out.push({ rule, evidence: m[0] });
        break;
      }
    }
  }
  return out;
}

// Confidence reflects how the inference was reached, not how true it is:
// an explicit self-description is stronger evidence than a generic keyword.
const CONF = { explicit: 0.8, keyword: 0.6, weak: 0.4, none: 0 };

export function classifyCompany(company) {
  const text = classifiableText(company);

  const stack = firstMatch(STACK_POSITIONS, text);
  const autonomy = firstMatch(AUTONOMY_LEVELS, text);
  const role = firstMatch(HUMAN_ROLES, text);
  const workflow = firstMatch(WORKFLOWS, text);

  // Industry from the company's own words. YC's own `industry` field is kept
  // separately by the caller; this one exists so the labour map works for
  // companies whose YC category says nothing about who they serve.
  let inferredIndustry = null;
  for (const [name, pattern] of Object.entries(INDUSTRY_TERMS)) {
    const m = text.match(pattern);
    if (m) {
      inferredIndustry = { label: name, evidence: m[0], confidence: CONF.keyword };
      break;
    }
  }
  const models = allMatches(BUSINESS_MODELS, text);
  const physicalHit = text.match(PHYSICAL_RE);
  const physicalCaps = allMatches(PHYSICAL_CAPABILITIES, text);

  // A capability is a dependency if the company shows demand for it; it is
  // supplied if the company describes building it. Supply is the stronger
  // claim, so it is checked first and wins.
  const dependsOn = [];
  const supplies = [];
  for (const cap of CAPABILITIES) {
    const supplyHit = cap.supply.map((p) => text.match(p)).find(Boolean);
    if (supplyHit) {
      supplies.push({ id: cap.id, label: cap.label, evidence: supplyHit[0], confidence: CONF.explicit });
      continue;
    }
    const demandHit = cap.demand.map((p) => text.match(p)).find(Boolean);
    if (demandHit) {
      dependsOn.push({ id: cap.id, label: cap.label, evidence: demandHit[0], confidence: CONF.weak });
    }
  }

  return {
    // §6 — where in the value chain
    stackPosition: stack
      ? { id: stack.rule.id, label: stack.rule.label, layer: stack.rule.layer, confidence: CONF.keyword, evidence: stack.evidence }
      : { id: "other", label: "Other", layer: "other", confidence: CONF.none, evidence: null },

    // §7 — what economic unit is automated
    autonomy: autonomy
      ? { level: autonomy.rule.level, label: autonomy.rule.label, confidence: CONF.keyword, evidence: autonomy.evidence }
      : { level: null, label: "Unknown", confidence: CONF.none, evidence: null },

    // §8 — the economic domain: whose job, which workflow, which industry
    humanRole: role
      ? { id: role.rule.id, label: role.rule.label, confidence: CONF.keyword, evidence: role.evidence }
      : { id: null, label: "Unknown", confidence: CONF.none, evidence: null },
    workflow: workflow
      ? { id: workflow.rule.id, label: workflow.rule.label, confidence: CONF.keyword, evidence: workflow.evidence }
      : { id: null, label: "Unknown", confidence: CONF.none, evidence: null },
    inferredIndustry,

    // §9 — how value is captured (multiple allowed)
    businessModels: models.slice(0, 3).map((m) => ({ id: m.rule.id, label: m.rule.label, evidence: m.evidence, confidence: CONF.keyword })),

    // §10 — digital vs physical
    physicality: physicalHit
      ? { value: physicalCaps.length >= 2 ? "Physical" : "Hybrid", confidence: CONF.keyword, evidence: physicalHit[0] }
      : { value: "Digital", confidence: CONF.weak, evidence: null },
    physicalCapabilities: physicalCaps.map((c) => ({ id: c.rule.id, label: c.rule.label, evidence: c.evidence })),

    // §11 — what it needs, and what it provides to others
    dependsOn,
    supplies,
  };
}

/** Version stamp so a stored classification can be traced to the rules that
 *  produced it (§5, §49). Bump when the rules above change materially. */
export const CLASSIFIER_VERSION = "dimensions@1";
