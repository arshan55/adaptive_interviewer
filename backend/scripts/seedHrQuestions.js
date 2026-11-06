#!/usr/bin/env node

/**
 * scripts/seedHrQuestions.js
 *
 * Seeds ~60 curated behavioral / HR interview questions across 8 themes:
 *   1. Conflict
 *   2. Leadership
 *   3. Failure & Resilience
 *   4. Ownership & Accountability
 *   5. Teamwork & Collaboration
 *   6. Motivation & Initiative
 *   7. Strengths & Weaknesses
 *   8. Culture Fit & Adaptability
 *
 * Each question includes a structured STAR evaluation rubric.
 *
 * Usage:
 *   node backend/scripts/seedHrQuestions.js [--dry-run]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const QuestionBank = require('../models/QuestionBank');

const isDryRun = process.argv.includes('--dry-run');

const HR_QUESTIONS = [
  // ----------------------------------------------------
  // THEME 1: Conflict (7 questions)
  // ----------------------------------------------------
  {
    title: "Handling Technical Disagreements",
    theme: "conflict",
    difficulty: "medium",
    questionText: "Tell me about a time you had a significant technical disagreement with a colleague or lead. How did you handle the situation, and what was the outcome?",
    rubricNotes: [
      "Situation: Context of the architectural or technical disagreement.",
      "Task: Objective to resolve differences without stalling delivery or harming relationships.",
      "Action: Data-driven discussion, prototyping, benchmarking, or seeking neutral mediator.",
      "Result: Agreed-upon resolution, lessons learned, and healthy working relationship maintained."
    ]
  },
  {
    title: "Working with a Difficult Teammate",
    theme: "conflict",
    difficulty: "easy",
    questionText: "Describe a situation where you had to work closely with someone whose working style or personality clashed with yours. How did you adapt?",
    rubricNotes: [
      "Situation: Specific working friction without disparaging the individual.",
      "Task: Delivering a shared project despite divergent communication/work preferences.",
      "Action: Active listening, clarifying expectations, setting boundaries, empathetic compromise.",
      "Result: Successful delivery and improved professional rapport."
    ]
  },
  {
    title: "Pushback Against Unrealistic Deadlines",
    theme: "conflict",
    difficulty: "medium",
    questionText: "Tell me about a time leadership or product management set an unrealistic deadline. How did you push back or navigate the expectation gap?",
    rubricNotes: [
      "Situation: Timeline crunch or scope creep impacting engineering quality.",
      "Task: Protecting system stability and team morale while respecting business urgency.",
      "Action: Quantifying trade-offs, proposing phased MVPs, presenting data on risks.",
      "Result: Revised realistic timeline, cut scope collaboratively, or delivered critical milestones safely."
    ]
  },
  {
    title: "Resolving Conflicting Priorities",
    theme: "conflict",
    difficulty: "medium",
    questionText: "Give an example of a time when two key stakeholders had conflicting requirements for a project you owned. How did you resolve the conflict?",
    rubricNotes: [
      "Situation: Competing priorities from separate departments or leaders.",
      "Task: Aligning stakeholders on a single unified path forward.",
      "Action: Facilitating joint discovery, anchoring to business goals, trade-off matrix.",
      "Result: Consensus achieved and clear roadmap established."
    ]
  },
  {
    title: "Addressing Code Review Tension",
    theme: "conflict",
    difficulty: "easy",
    questionText: "Tell me about a time a pull request review became contentious or stalled. How did you resolve it?",
    rubricNotes: [
      "Situation: Disputed review comments or stylistic versus fundamental design debate.",
      "Task: Unblocking PR review without personal friction.",
      "Action: Transitioning from asynchronous chat to a live sync/pairing session, referencing style guides.",
      "Result: Clean merge and shared understanding established."
    ]
  },
  {
    title: "Handling Negative Feedback",
    theme: "conflict",
    difficulty: "easy",
    questionText: "Describe a time you received constructive or critical feedback from a manager or peer that you initially disagreed with. What did you do?",
    rubricNotes: [
      "Situation: Unexpected critical review or performance feedback.",
      "Task: Processing emotional reaction professionally and objectively.",
      "Action: Asking clarifying questions, evaluating validity with third-party perspective, implementing actionable adjustments.",
      "Result: Personal growth, tangible improvement in performance or habits."
    ]
  },
  {
    title: "De-escalating Customer or Cross-Team Friction",
    theme: "conflict",
    difficulty: "hard",
    questionText: "Tell me about a time an incident or regression caused high stress and finger-pointing between teams. How did you navigate the blame and focus on remediation?",
    rubricNotes: [
      "Situation: High-severity incident with cross-functional blame.",
      "Task: Refocusing energy from blaming to blameless root-cause analysis and recovery.",
      "Action: Calm communication, objective metrics, facilitating a blameless post-mortem.",
      "Result: System restored, process patched, psychological safety preserved."
    ]
  },

  // ----------------------------------------------------
  // THEME 2: Leadership (8 questions)
  // ----------------------------------------------------
  {
    title: "Leading a Project Without Formal Authority",
    theme: "leadership",
    difficulty: "medium",
    questionText: "Tell me about a time you led an initiative or project where you had no formal authority over the participants.",
    rubricNotes: [
      "Situation: Cross-team project requiring influence without authority.",
      "Task: Motivating peers to contribute toward a shared milestone.",
      "Action: Articulating the vision, creating clear task ownership, removing roadblocks, celebrating contributions.",
      "Result: Project successfully completed on schedule with enthusiastic peer support."
    ]
  },
  {
    title: "Mentoring a Struggling Engineer",
    theme: "leadership",
    difficulty: "medium",
    questionText: "Can you share an experience where you mentored a junior teammate or intern who was struggling? What approach did you take?",
    rubricNotes: [
      "Situation: Junior teammate lacking confidence or falling behind on deliverables.",
      "Task: Supporting their development without micromanaging or doing the work for them.",
      "Action: Pair programming, structured 1-on-1s, breaking tasks into manageable goals, constructive feedback.",
      "Result: Mentee gained autonomy, completed tasks independently, grew confidence."
    ]
  },
  {
    title: "Driving Technical Strategy or Migration",
    theme: "leadership",
    difficulty: "hard",
    questionText: "Describe a time you recognized a major architectural bottleneck or technical debt and championed a migration or refactor.",
    rubricNotes: [
      "Situation: Aging stack, scalability hurdle, or high maintenance overhead.",
      "Task: Pitching non-feature technical work to leadership and getting team buy-in.",
      "Action: Building a prototype, demonstrating business ROI, creating incremental adoption plan.",
      "Result: Successful phased rollout with zero downtime or measurable performance gain."
    ]
  },
  {
    title: "Making an Unpopular Decision",
    theme: "leadership",
    difficulty: "hard",
    questionText: "Tell me about a tough decision you made as a lead or contributor that wasn't popular with the team. How did you communicate and execute it?",
    rubricNotes: [
      "Situation: Necessary operational or engineering change opposed by some peers.",
      "Task: Deciding decisively while maintaining morale and trust.",
      "Action: Transparently explaining the 'why', acknowledging drawbacks, creating avenues for feedback.",
      "Result: Smooth execution, long-term justification validated."
    ]
  },
  {
    title: "Setting Team Standards and Best Practices",
    theme: "leadership",
    difficulty: "easy",
    questionText: "How have you contributed to elevating the engineering standards, testing culture, or operational rigor on your team?",
    rubricNotes: [
      "Situation: Inconsistent testing, loose linting, or fragile deployments.",
      "Task: Establishing shared norms without creating bureaucratic drag.",
      "Action: Introducing automated tooling (CI lint/test), creating documentation templates, leading by example.",
      "Result: Reduced bug rate, streamlined onboarding for new hires."
    ]
  },
  {
    title: "Delegating Responsibilities Effectively",
    theme: "leadership",
    difficulty: "medium",
    questionText: "Tell me about a time you had too much on your plate and had to delegate critical responsibilities. How did you decide what to delegate?",
    rubricNotes: [
      "Situation: Overcommitted with multiple high-stakes deliverables.",
      "Task: Distributing tasks according to team members' strengths and growth opportunities.",
      "Action: Providing full context, defining success criteria, setting check-ins while allowing creative freedom.",
      "Result: Successfully delivered on all fronts while empowering colleagues."
    ]
  },
  {
    title: "Advocating for Team Well-being and Morale",
    theme: "leadership",
    difficulty: "medium",
    questionText: "Describe a period of intense pressure or crunch for your team. What steps did you take to protect team morale and avoid burnout?",
    rubricNotes: [
      "Situation: Extended sprint, high-stress release, or crisis management.",
      "Task: Delivering required results while preventing burnout and disengagement.",
      "Action: Prioritizing ruthlessly, filtering out non-essential tasks, recognizing extra efforts, fostering humor/empathy.",
      "Result: Milestone achieved with team intact and sustained trust."
    ]
  },
  {
    title: "Onboarding and Ramping New Hires",
    theme: "leadership",
    difficulty: "easy",
    questionText: "How do you help new engineers get up to speed quickly when they join your team?",
    rubricNotes: [
      "Situation: Fresh teammate joining complex codebase.",
      "Task: Shortening time-to-first-commit and building confidence.",
      "Action: Curating starter bugs, pairing, reviewing onboarding docs, being accessible for questions.",
      "Result: Rapid ramp-up and positive onboarding experience."
    ]
  },

  // ----------------------------------------------------
  // THEME 3: Failure & Resilience (8 questions)
  // ----------------------------------------------------
  {
    title: "Causing a Production Outage",
    theme: "failure",
    difficulty: "medium",
    questionText: "Tell me about a time a change you authored or approved caused a production incident or outage. What happened and what did you learn?",
    rubricNotes: [
      "Situation: Production regression caused by oversight, missing test, or edge case.",
      "Task: Immediate mitigation, followed by permanent prevention.",
      "Action: Owning the mistake immediately, executing rollback, writing thorough post-mortem with preventative tests.",
      "Result: Zero repeat incidents in that category; enhanced test pipeline."
    ]
  },
  {
    title: "A Project That Failed to Meet Its Goals",
    theme: "failure",
    difficulty: "hard",
    questionText: "Describe a project you poured significant effort into that ultimately failed or was scrapped. How did you handle the disappointment?",
    rubricNotes: [
      "Situation: Project canceled due to strategic pivot, user disinterest, or technical infeasibility.",
      "Task: Extracting valuable learnings and salvaging modular components.",
      "Action: Documenting lessons, conducting retrospective, repurposing valuable code/knowledge.",
      "Result: Mature response, positive attitude, intellectual property applied to subsequent wins."
    ]
  },
  {
    title: "Missing an Important Commitment",
    theme: "failure",
    difficulty: "easy",
    questionText: "Tell me about a time you realized you were going to miss an important deadline. When did you realize it and what did you do?",
    rubricNotes: [
      "Situation: Underestimated task or unforeseen blocker making deadline unachievable.",
      "Task: Communicating early to allow contingency planning.",
      "Action: Proactively notifying stakeholders well before the deadline with alternative options and updated ETA.",
      "Result: Minimized fallout, maintained credibility through transparency."
    ]
  },
  {
    title: "Poor Architectural Decision in Hindsight",
    theme: "failure",
    difficulty: "medium",
    questionText: "Tell me about an architectural or design choice you made that didn't age well. In hindsight, what would you do differently?",
    rubricNotes: [
      "Situation: Technology choice (e.g., premature optimization, wrong DB, overly complex abstraction) that caused pain later.",
      "Task: Reflecting objectively on trade-offs without making excuses.",
      "Action: Diagnosing why the decision was flawed, refactoring or adapting the system.",
      "Result: Deeper understanding of constraints, evolved architectural philosophy."
    ]
  },
  {
    title: "Handling Underestimation of Scope",
    theme: "failure",
    difficulty: "easy",
    questionText: "Have you ever severely underestimated the complexity of a task? How did you recover once you discovered the hidden iceberg?",
    rubricNotes: [
      "Situation: Quick 2-day ticket that revealed massive legacy entanglements.",
      "Task: Managing expectations and adjusting strategy.",
      "Action: Stopping to reassess full scope, communicating findings, breaking into incremental milestones.",
      "Result: Safely executed without cutting dangerous corners."
    ]
  },
  {
    title: "Failed Experiment or Feature Launch",
    theme: "failure",
    difficulty: "medium",
    questionText: "Describe a feature or A/B test you built that produced negative metrics or poor user adoption. What was your response?",
    rubricNotes: [
      "Situation: Feature launched with negative conversion or user confusion.",
      "Task: Analyzing telemetry data without ego.",
      "Action: Digging into user session logs, gathering qualitative feedback, deciding whether to iterate or kill.",
      "Result: Uncluttered product, valuable insights into user behavior."
    ]
  },
  {
    title: "Navigating Sudden Reorganization or Strategy Shift",
    theme: "failure",
    difficulty: "medium",
    questionText: "Tell me about a time company priorities shifted overnight, disrupting your ongoing roadmap. How did you adapt?",
    rubricNotes: [
      "Situation: Sudden pivot leaving in-flight work stranded.",
      "Task: Quickly pivoting focus without lingering resentment.",
      "Action: Wrapping up current work cleanly, aligning with new mission, helping teammates transition.",
      "Result: Rapid contribution to new company goals."
    ]
  },
  {
    title: "Recovering from Burnout or High Stress",
    theme: "failure",
    difficulty: "easy",
    questionText: "How do you manage your own workload and stress when demands exceed capacity?",
    rubricNotes: [
      "Situation: Intense workload threatening personal effectiveness.",
      "Task: Restoring sustainable productivity.",
      "Action: Setting boundaries, time-blocking, communicating bandwidth limits clearly, taking structured recovery time.",
      "Result: Consistent long-term high performance without burnout."
    ]
  },

  // ----------------------------------------------------
  // THEME 4: Ownership & Accountability (8 questions)
  // ----------------------------------------------------
  {
    title: "Going Above and Beyond Job Description",
    theme: "ownership",
    difficulty: "easy",
    questionText: "Tell me about a time you noticed an important problem that wasn't anyone's responsibility, and you stepped in to solve it.",
    rubricNotes: [
      "Situation: Unclaimed gap in operations, developer tooling, or customer experience.",
      "Task: Taking initiative outside formal job duties.",
      "Action: Investigating root causes, building a solution, ensuring smooth handover or automation.",
      "Result: Lasting improvement for the team or product."
    ]
  },
  {
    title: "Taking Responsibility for a Team Miss",
    theme: "ownership",
    difficulty: "medium",
    questionText: "Describe a situation where a project failed or hit a snag, and you took accountability even though others contributed to the issue.",
    rubricNotes: [
      "Situation: Shared project stumble where pointing fingers was possible.",
      "Task: Fostering accountability and moving the team forward.",
      "Action: Owning your part publicly, avoiding blame, organizing the recovery effort.",
      "Result: Reinforced team psychological safety and delivered resolution."
    ]
  },
  {
    title: "Maintaining Production Systems After Launch",
    theme: "ownership",
    difficulty: "easy",
    questionText: "How do you treat the lifecycle of a feature after it merges? How do you ensure long-term health and monitoring?",
    rubricNotes: [
      "Situation: Post-launch operational phase.",
      "Task: Ensuring feature is observable, resilient, and performant.",
      "Action: Creating dashboards, alert thresholds, runbooks, monitoring error budgets.",
      "Result: Low MTTR and minimal surprise regressions."
    ]
  },
  {
    title: "Refusing to Ship Subpar Code",
    theme: "ownership",
    difficulty: "medium",
    questionText: "Tell me about a time you were pressured to ship code you knew had critical flaws or security vulnerabilities. What did you do?",
    rubricNotes: [
      "Situation: Delivery pressure versus engineering integrity.",
      "Task: Preventing dangerous defects from reaching production.",
      "Action: Demonstrating concrete risks, proposing quick interim mitigations, standing firm with respect.",
      "Result: Defect resolved before deployment, preventing customer harm."
    ]
  },
  {
    title: "Balancing Tech Debt with New Features",
    theme: "ownership",
    difficulty: "medium",
    questionText: "How do you actively advocate for addressing technical debt alongside aggressive business feature roadmaps?",
    rubricNotes: [
      "Situation: Legacy debt slowing team velocity.",
      "Task: Securing sprint allocation for tech health.",
      "Action: Tying tech debt to business impact (velocity metrics, outage risks), boy scout rule in PRs.",
      "Result: Sustainable delivery cadence."
    ]
  },
  {
    title: "Conducting a Thorough Post-Mortem",
    theme: "ownership",
    difficulty: "medium",
    questionText: "Walk me through the best post-mortem or retrospective you ever led. How did you ensure action items were actually completed?",
    rubricNotes: [
      "Situation: Post-incident analysis.",
      "Task: Uncovering systemic flaws without scapegoating individuals.",
      "Action: The 5-whys technique, tracking specific JIRA tickets with designated owners.",
      "Result: Measurable hardening of infrastructure."
    ]
  },
  {
    title: "Handling Customer-Impacting Edge Cases",
    theme: "ownership",
    difficulty: "hard",
    questionText: "Tell me about a complex edge-case bug that affected only a tiny fraction of users. How did you prioritize and solve it?",
    rubricNotes: [
      "Situation: Obscure, hard-to-reproduce bug affecting minority of users.",
      "Task: Showing empathy and determination to resolve.",
      "Action: Deep-diving into logs, reproducing in isolated test bed, deploying targeted fix.",
      "Result: Resolved customer pain and hardened edge-case testing."
    ]
  },
  {
    title: "Improving Developer Experience (DevEx)",
    theme: "ownership",
    difficulty: "easy",
    questionText: "What is something you built or improved that saved your fellow engineers hours of friction or manual toil?",
    rubricNotes: [
      "Situation: Slow build times, manual deployment steps, or tedious local setup.",
      "Task: Streamlining internal developer experience.",
      "Action: Automating scripts, improving Docker containers, creating mock data seeders.",
      "Result: Dramatic reduction in setup/build friction across team."
    ]
  },

  // ----------------------------------------------------
  // THEME 5: Teamwork & Collaboration (8 questions)
  // ----------------------------------------------------
  {
    title: "Cross-Functional Collaboration with Product and Design",
    theme: "teamwork",
    difficulty: "easy",
    questionText: "Tell me about a project where you partnered closely with Product Managers and Designers. How did you ensure smooth handoffs and alignment?",
    rubricNotes: [
      "Situation: Joint engineering-product-design effort.",
      "Task: Bridging technical feasibility with user experience goals.",
      "Action: Early feasibility reviews, iterative prototypes, mutual respect for expertise.",
      "Result: Cohesive, user-centric feature delivered on time."
    ]
  },
  {
    title: "Supporting a Team Member Under Pressure",
    theme: "teamwork",
    difficulty: "easy",
    questionText: "Tell me about a time a teammate was overwhelmed or facing personal difficulties, and you stepped in to help carry the load.",
    rubricNotes: [
      "Situation: Teammate overloaded or facing external hardship.",
      "Task: Ensuring project continuity while showing genuine empathy.",
      "Action: Voluntarily picking up tickets, running on-call coverage, communicating status.",
      "Result: Deliverables met, teammate supported without feeling undermined."
    ]
  },
  {
    title: "Working Effectively Across Time Zones",
    theme: "teamwork",
    difficulty: "medium",
    questionText: "Describe your experience collaborating with remote teammates or cross-functional partners across different time zones.",
    rubricNotes: [
      "Situation: Distributed team with 6+ hours time difference.",
      "Task: Maintaining momentum without round-the-clock synchronous calls.",
      "Action: High-fidelity async documentation, recording video walkthroughs, clear handoff notes.",
      "Result: Continuous 24-hour cycle of progress without burnout."
    ]
  },
  {
    title: "Pair Programming to Solve a Complex Bug",
    theme: "teamwork",
    difficulty: "easy",
    questionText: "Tell me about a time you paired with another engineer to solve a stubborn problem. How did you split the driving and navigating?",
    rubricNotes: [
      "Situation: Difficult bug resisting solo attempts.",
      "Task: Combining cognitive power effectively.",
      "Action: Collaborative hypothesis testing, alternating typing and thinking.",
      "Result: Bug identified and fixed, mutual learning achieved."
    ]
  },
  {
    title: "Contributing to Open Source or Shared Internal Libraries",
    theme: "teamwork",
    difficulty: "medium",
    questionText: "Have you contributed to a shared platform library or open-source tool used by many other engineers? How did you handle change management?",
    rubricNotes: [
      "Situation: Building reusable infrastructure for other teams.",
      "Task: Shipping improvements without breaking existing consumers.",
      "Action: Semantic versioning, backwards compatibility guarantees, clear migration docs.",
      "Result: High adoption with minimal consumer disruption."
    ]
  },
  {
    title: "Giving Difficult Feedback with Empathy",
    theme: "teamwork",
    difficulty: "medium",
    questionText: "Describe a time you had to deliver difficult, constructive feedback to a peer. How did you approach the conversation?",
    rubricNotes: [
      "Situation: Peer behavior or work quality needing correction.",
      "Task: Delivering candid feedback without eliciting defensive hostility.",
      "Action: Private 1-on-1, SBI model (Situation-Behavior-Impact), focusing on growth.",
      "Result: Receptive peer response and sustained working relationship."
    ]
  },
  {
    title: "Integrating Divergent Architectural Ideas",
    theme: "teamwork",
    difficulty: "hard",
    questionText: "Tell me about a time two senior engineers had opposing designs for a core system. How did the team evaluate and integrate the best of both?",
    rubricNotes: [
      "Situation: Competing proposals with strong opinions on both sides.",
      "Task: Driving objective evaluation without team division.",
      "Action: Defining shared evaluation criteria, running proof-of-concept tests.",
      "Result: Synthesized design combining strengths of both approaches."
    ]
  },
  {
    title: "Fostering an Inclusive Team Culture",
    theme: "teamwork",
    difficulty: "easy",
    questionText: "How do you ensure quieter or less experienced teammates have an equal voice in team discussions and architectural planning?",
    rubricNotes: [
      "Situation: Meetings dominated by vocal contributors.",
      "Task: Creating an equitable forum for ideas.",
      "Action: Async RFC documents, explicitly inviting input, giving credit for ideas.",
      "Result: Diverse perspectives integrated into core decisions."
    ]
  },

  // ----------------------------------------------------
  // THEME 6: Motivation & Initiative (7 questions)
  // ----------------------------------------------------
  {
    title: "Self-Directed Learning of New Technology",
    theme: "motivation",
    difficulty: "easy",
    questionText: "Tell me about a technology, framework, or paradigm you had to learn quickly on your own to solve a business problem.",
    rubricNotes: [
      "Situation: Urgent requirement in an unfamiliar stack or library.",
      "Task: Rapidly building production proficiency.",
      "Action: Deep dive into docs, building quick spike projects, seeking expert input.",
      "Result: Production feature delivered safely in record time."
    ]
  },
  {
    title: "Prototyping an Innovation During Hackathon or 20% Time",
    theme: "motivation",
    difficulty: "easy",
    questionText: "Describe a hackathon project, side experiment, or innovative tool you conceived and built that brought real value.",
    rubricNotes: [
      "Situation: Opportunity for creative experimentation.",
      "Task: Developing a working prototype with minimal resources.",
      "Action: Ruthless scoping, rapid building, presenting clear value proposition.",
      "Result: Prototype graduated into real production roadmap."
    ]
  },
  {
    title: "Maintaining Passion and Discipline in Monotonous Work",
    theme: "motivation",
    difficulty: "medium",
    questionText: "How do you stay motivated and deliver high quality during tedious phases of a project, like data cleansing, migration scripts, or compliance audits?",
    rubricNotes: [
      "Situation: Unexciting but critical operational work.",
      "Task: Maintaining meticulous attention to detail and momentum.",
      "Action: Automating repetitive tasks, gamifying progress, focusing on ultimate business impact.",
      "Result: Flawless execution without careless errors."
    ]
  },
  {
    title: "Challenging the Status Quo",
    theme: "motivation",
    difficulty: "medium",
    questionText: "Tell me about a time you looked at an established process or architecture and asked 'Why are we doing it this way?' What happened?",
    rubricNotes: [
      "Situation: Legacy process blindly accepted by team.",
      "Task: Investigating whether better modern alternatives exist.",
      "Action: Analyzing bottlenecks, proposing modern alternative, demonstrating clear benefits.",
      "Result: Process modernized with significant team time saved."
    ]
  },
  {
    title: "Driving Customer Empathy in Engineering",
    theme: "motivation",
    difficulty: "easy",
    questionText: "How do you stay connected to the real-world end users who interact with your software every day?",
    rubricNotes: [
      "Situation: Danger of engineers living in an isolated bubble.",
      "Task: Grounding architectural decisions in end-user value.",
      "Action: Reviewing support tickets, listening to customer sales calls, reviewing analytics.",
      "Result: Features built that solve actual customer pain points."
    ]
  },
  {
    title: "Pursuing Professional Growth and Mastery",
    theme: "motivation",
    difficulty: "easy",
    questionText: "What are you currently learning or exploring outside your day-to-day job to make yourself a sharper engineer?",
    rubricNotes: [
      "Situation: Continuous learning journey.",
      "Task: Sustained curiosity and intellectual growth.",
      "Action: Concrete books, open-source projects, courses, or experiments.",
      "Result: Broadened perspective applied to engineering challenges."
    ]
  },
  {
    title: "Steering Career Toward Greater Impact",
    theme: "motivation",
    difficulty: "medium",
    questionText: "Tell me about a pivotal moment in your career where you made a deliberate choice to step out of your comfort zone.",
    rubricNotes: [
      "Situation: Comfortable plateau versus challenging opportunity.",
      "Task: Choosing growth over convenience.",
      "Action: Taking on higher responsibility, changing domain, or tackling unfamiliar scale.",
      "Result: Acceleration of skill set and leadership maturity."
    ]
  },

  // ----------------------------------------------------
  // THEME 7: Strengths & Weaknesses (7 questions)
  // ----------------------------------------------------
  {
    title: "Self-Assessing Your Greatest Technical Strength",
    theme: "strengths/weaknesses",
    difficulty: "easy",
    questionText: "What do you consider your greatest technical superpower, and how have you used it to create significant impact on a project?",
    rubricNotes: [
      "Situation: Identifying core competency (e.g. debugging, systems thinking, velocity, developer tooling).",
      "Task: Applying this strength to a difficult challenge.",
      "Action: Concrete example of strength in action.",
      "Result: Measurable benefit to product or team."
    ]
  },
  {
    title: "Authentic Growth Area or Weakness",
    theme: "strengths/weaknesses",
    difficulty: "medium",
    questionText: "What is a legitimate weakness or growth area you are currently working on? What concrete steps are you taking to improve?",
    rubricNotes: [
      "Situation: Genuine professional growth area (avoiding humblebrags).",
      "Task: Self-awareness of how this area affects your work.",
      "Action: Tangible systems, habits, mentors, or tools in place to mitigate.",
      "Result: Evidence of progress and disciplined self-improvement."
    ]
  },
  {
    title: "Overcoming Perfectionism vs. Pragmatism",
    theme: "strengths/weaknesses",
    difficulty: "medium",
    questionText: "Tell me about a time your desire for elegant or perfect code got in the way of shipping value. How do you find the balance today?",
    rubricNotes: [
      "Situation: Over-engineering or delaying release for marginal technical gains.",
      "Task: Recognizing the trade-off between perfection and speed to market.",
      "Action: Adopting iterative thinking, setting strict timeboxes, prioritizing feedback loops.",
      "Result: Pragmatic shipping cadence while keeping code clean."
    ]
  },
  {
    title: "Handling Imposter Syndrome or Unfamiliar Domains",
    theme: "strengths/weaknesses",
    difficulty: "easy",
    questionText: "Have you ever found yourself in a room or project where everyone seemed far more knowledgeable than you? How did you contribute effectively?",
    rubricNotes: [
      "Situation: High-stakes domain where candidate was the least experienced in the room.",
      "Task: Contributing meaningfully without pretending or withdrawing.",
      "Action: Asking insightful questions, taking thorough notes, owning foundational tasks.",
      "Result: Built deep respect and mastered domain rapidly."
    ]
  },
  {
    title: "Balancing Deep Work with Interruptions",
    theme: "strengths/weaknesses",
    difficulty: "easy",
    questionText: "As engineers, context switching can derail productivity. How do you protect your focus time while remaining an accessible, helpful teammate?",
    rubricNotes: [
      "Situation: Constant Slack pings, on-call alerts, and meeting sprawl.",
      "Task: Maintaining coding flow while supporting team needs.",
      "Action: Calendar blocking, batching communications, clear status messages, creating async documentation.",
      "Result: High focus output and prompt support during designated windows."
    ]
  },
  {
    title: "Learning from Critical Performance Reviews",
    theme: "strengths/weaknesses",
    difficulty: "medium",
    questionText: "Think back to the most critical piece of performance feedback you ever received. How did it change how you operate today?",
    rubricNotes: [
      "Situation: Honest assessment of past blind spot.",
      "Task: Transforming critique into long-term behavioral change.",
      "Action: Setting up feedback checkpoints, modifying habits, tracking progress.",
      "Result: Former weakness transformed into recognized strength."
    ]
  },
  {
    title: "Saying 'No' to Protect Quality and Focus",
    theme: "strengths/weaknesses",
    difficulty: "hard",
    questionText: "Tell me about a time you had to say 'no' to a request from a senior stakeholder or leader to protect system integrity or team focus.",
    rubricNotes: [
      "Situation: High-pressure request that would compromise stability or derail commitments.",
      "Task: Declining or renegotiating respectfully with executive presence.",
      "Action: Showing trade-offs, explaining the consequence of 'yes', proposing viable alternatives.",
      "Result: Stakeholder respected the courage and alternative compromise succeeded."
    ]
  },

  // ----------------------------------------------------
  // THEME 8: Culture Fit & Adaptability (7 questions)
  // ----------------------------------------------------
  {
    title: "Thriving in Ambiguity and Moving Targets",
    theme: "culture fit",
    difficulty: "medium",
    questionText: "Tell me about a project where requirements were vague, contradictory, or constantly evolving. How did you navigate forward?",
    rubricNotes: [
      "Situation: Early-stage project with poorly defined specifications.",
      "Task: Delivering progress without waiting for complete clarity.",
      "Action: Defining core assumptions, building modular prototypes, holding rapid stakeholder check-ins.",
      "Result: Crystallized requirements and delivered on time."
    ]
  },
  {
    title: "Adapting to Cultural or Process Changes",
    theme: "culture fit",
    difficulty: "easy",
    questionText: "Tell me about a time your team underwent a major shift in process (e.g. adopting Agile/Scrum, changing deployment cadence, or new tooling). How did you adapt?",
    rubricNotes: [
      "Situation: Disruptive process overhaul.",
      "Task: Maintaining productivity and helping the team adopt the new paradigm.",
      "Action: Embracing the change with open mind, giving constructive feedback on process bugs.",
      "Result: Smooth transition and improved team efficiency."
    ]
  },
  {
    title: "Why Our Mission and Team?",
    theme: "culture fit",
    difficulty: "easy",
    questionText: "What excites you most about the problems we are solving, and what kind of environment brings out your best work?",
    rubricNotes: [
      "Situation: Aligning candidate values with team mission.",
      "Task: Demonstrating genuine understanding of the problem space.",
      "Action: Citing specific aspects of the technical or product mission that resonate.",
      "Result: Clear cultural resonance and intrinsic motivation."
    ]
  },
  {
    title: "Operating in High-Autonomy Environments",
    theme: "culture fit",
    difficulty: "medium",
    questionText: "In our engineering team, developers have high autonomy with little micro-management. Can you share an example of how you run your day-to-day when nobody is telling you what to do?",
    rubricNotes: [
      "Situation: Open-ended environment requiring self-direction.",
      "Task: Setting your own priorities and milestones aligned with company goals.",
      "Action: Establishing personal roadmaps, proactively communicating blockers, self-initiating code reviews.",
      "Result: Consistent output without requiring managerial hand-holding."
    ]
  },
  {
    title: "Promoting Transparency and Knowledge Sharing",
    theme: "culture fit",
    difficulty: "easy",
    questionText: "How do you ensure you don't become a single point of failure (SPOF) for critical knowledge or infrastructure?",
    rubricNotes: [
      "Situation: Solo author of critical system.",
      "Task: Democratizing knowledge across the team.",
      "Action: Writing architecture docs, recording Loom/demos, holding lunch-and-learns, pairing.",
      "Result: System safely maintained by any teammate."
    ]
  },
  {
    title: "Navigating Ethical or Privacy Dilemmas in Code",
    theme: "culture fit",
    difficulty: "hard",
    questionText: "Have you ever encountered a design or implementation detail that raised data privacy, security, or ethical concerns? How did you raise it?",
    rubricNotes: [
      "Situation: Feature or logging practice that risked customer privacy or security.",
      "Task: Raising red flag responsibly.",
      "Action: Documenting exact vulnerability, citing compliance/legal standards, proposing secure alternative.",
      "Result: Vulnerability remedied before customer data was endangered."
    ]
  },
  {
    title: "Maintaining Humility and Curiosity at Senior Levels",
    theme: "culture fit",
    difficulty: "medium",
    questionText: "As engineers grow in seniority, it can be tempting to rely on past answers. How do you keep your curiosity alive and remain open to being wrong?",
    rubricNotes: [
      "Situation: Danger of dogmatism with increasing seniority.",
      "Task: Maintaining a beginner's mind.",
      "Action: Welcoming questions from juniors, actively seeking feedback on your own PRs, testing new ideas.",
      "Result: Inspiring humble, evidence-based engineering culture."
    ]
  }
];

async function main() {
  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error('MONGODB_URI not set. Exiting.');
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  console.log(`Seeding ${HR_QUESTIONS.length} behavioral questions across 8 themes... (dryRun=${isDryRun})`);

  let added = 0;
  let updated = 0;

  for (const q of HR_QUESTIONS) {
    const query = {
      title: q.title,
      role: 'software-engineer',
      isCodingProblem: false
    };

    const docData = {
      questionId: randomUUID(),
      title: q.title,
      normalizedTitle: q.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      questionText: q.questionText,
      topic: `Behavioral / ${q.theme.charAt(0).toUpperCase() + q.theme.slice(1)}`,
      tags: ['hr', 'behavioral', q.theme],
      role: 'software-engineer',
      difficulty: q.difficulty,
      isCodingProblem: false,
      rubricNotes: q.rubricNotes,
      sourceSystem: 'curated-behavioral-seed'
    };

    if (isDryRun) {
      console.log(`[DRY-RUN] Would upsert: "${q.title}" (Theme: ${q.theme}, Diff: ${q.difficulty})`);
      added++;
      continue;
    }

    const existing = await QuestionBank.findOne(query);
    if (!existing) {
      await QuestionBank.create(docData);
      added++;
    } else {
      await QuestionBank.updateOne(
        { _id: existing._id },
        { $set: { rubricNotes: q.rubricNotes, tags: docData.tags, topic: docData.topic } }
      );
      updated++;
    }
  }

  console.log(`Done! Added: ${added}, Updated: ${updated}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error in seedHrQuestions:', err);
    process.exit(1);
  });
}

module.exports = { HR_QUESTIONS };

