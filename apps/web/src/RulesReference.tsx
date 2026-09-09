import { useState, type CSSProperties } from "react";
import { CircleHelp, X } from "lucide-react";
import { missionSeats, type Seat } from "@rifts/rules";
import { playableMission } from "@rifts/content";
import { identities } from "./EngineConsole.js";

const engineRules: Record<
  Seat,
  {
    kit: string;
    rules: string[];
    growth: string;
    cooperation: string;
    example: string;
  }
> = {
  dice: {
    kit: "Five six-sided dice each round, and six systems on the platform to put them in. You will never fill all six, so every round is a decision about what the machine is not doing.",
    rules: [
      "Allocate dice to systems, then fire a system. Drive powers Move, Targeting powers Engage, Stabilizer powers Contribute and Shield powers Recover. Allocation is free and reversible until the system fires.",
      "A die in a system is worth 1, or 2 if it shows 4 or more. Firing spends everything in that system at once, so a heavily loaded system is one big commitment rather than several small ones.",
      "A calibrated system does far more with the same dice. Matching faces lock it on and double its output; three or more consecutive faces spin it up and add the length of the run. Mismatched dice still fire, for what they are individually worth.",
      "Hold over keeps a die through the refill with its face intact. It does nothing for you this round, which is the price: you are buying a future combination with this round's capability, and a held die counts against your allotment rather than adding to it.",
      "The Boom Gun doubles every die in it, but it cannot fire unbraced: Bracing must hold a die, and that die is spent with the shot for no output of its own. Engaging fires Targeting, Boom Gun and Bracing together.",
      "Assist, Acquire and Investigate are pilot work, not platform work. Each takes a single die still loose in the tray, and Assist still needs a 3 or better.",
    ],
    growth:
      "Field experience adds a sixth die in round 3 and a seventh in round 5. More dice mean more systems live at once and a better chance of assembling a set or a run, which is where the extra reach actually shows. Keeping your core adds one more on top.",
    cooperation:
      "A loaded Boom Gun is three dice that cannot move you, shield you or stabilise the breach. That is the trade the rest of the team is relying on you to make: hold the hall and hit hard, or stay mobile and contribute steadily.",
    example:
      "Two dice into Drive carries you to the gate. A 5 into Targeting, a 6 into the Boom Gun and any die into Bracing takes 2 + (2 x 2) = 6 off a patrol in one shot, and empties the tray. Two matching 5s in Targeting would have doubled that half of it instead. Leaving the Boom Gun loaded but unbraced wastes it entirely, which the panel says before you commit.",
  },
  cards: {
    kit: "Five cards each round: two Channel, two Resonance, and one Exploit Opening. Played cards leave your hand until the next round.",
    rules: [
      "A weave alternates Channel and Resonance, and it runs as long as your hand can sustain it. Cards commit in the order you select them, and that order is the chain.",
      "Length is the skill, because a weave pays more than its cards are worth apart: one gives 1, two give 3, three give 6 and four give 10. A broken chain gives nothing at all, and the thread across your hand shows whether it holds before you commit.",
      "Exploit Opening stands in for either side of the chain, which is its second use and a real decision against saving it. On its own, after the relay suppresses the shield, it still gives +2 when used to Assist.",
      "Hold keeps a card through the deal with the chain you are building around it. It sits out this round, which is the price, and it counts against your new hand rather than adding to it: you are buying next round's longer weave with this round's play.",
      "Moving needs only one card; extra effect does not improve movement, so never spend a chain on a step.",
    ],
    growth:
      "Field experience adds a Channel in round 3 and a Resonance in round 5, so the hand reaches seven cards. Because length pays superlinearly, each addition is worth more than the last: the seventh card is what makes a weave of four possible at all. Keeping your core adds +1 to every weave.",
    cooperation:
      "Weave long for the team's decisive contribution, or hold a card or two so next round opens with the chain already part built. Spending Exploit Opening as a wildcard keeps a chain alive; saving it keeps a response available during the same team round.",
    example:
      "Channel, Resonance, Channel is a weave of 3 for 6 effect, against the 4 those cards are worth as a pair plus a single. Add Exploit Opening on the end as a stand-in Resonance and the same hand pays 10. Hold one Channel back instead and four fresh cards deal around it next round, opening with a link already placed.",
  },
  bag: {
    kit: "A fresh bag each round: six safe tokens and two hazards. Safe find, cache, and signal tokens each give 1 effect; their names do not restrict which action they can fund.",
    rules: [
      "Push to add a hidden token to your surge. A hazard destroys the whole surge and costs the team one instability for every token lost, plus one for each burnout already taken this round. Busting with an empty hand risked nothing, so it costs nothing.",
      "A hazard goes back into the bag; safe tokens leave it when drawn. The odds therefore only ever get worse within a round, and the band above the Push button reports them before each push.",
      "What comes out matters as much as how much. A surge of a single kind is clean and pays its own size again; a surge holding all three of find, cache and signal is a full spread and doubles. So a push is sometimes for the kind you are missing rather than for one more token.",
      "Committing an action spends your entire surge, so push to the size and the mix the action deserves. Move once, contribute hard. With no surge you can still spend a shared resource, exactly like the other engines.",
      "Hold keeps tokens through the refill, but holding means staying amped: you start next round with that many burns already counted against you, so the first bust of the new round costs more than it otherwise would.",
    ],
    growth:
      "Field experience adds a jackpot to the bag in round 3 and another in round 5, and never removes a hazard. A jackpot counts 2 by itself and still lets a full spread double, but it breaks a clean single-kind pull. Later pushes pay more without becoming safer, which is the point. Keeping your core converts one hazard into a jackpot as well.",
    cooperation:
      "Every action is its own decision about how far to push, and now about what to push for. A small clean surge for a move keeps the bag alive for a larger contribution later; one long push can produce the team's biggest single effect, or cost the round and raise instability where everyone can see it.",
    example:
      "Three pushes giving find, cache and signal is a full spread: 3 doubled to 6, where a find, a find and a cache would have been worth 3. Three finds would be clean, worth 3 + 3 = 6 as well. Pushing a fourth time for a bigger number risks the entire surge on odds the console shows you first, and can break the spread you already had.",
  },
  systems: {
    kit: "Four placement markers each round. Commit one marker per engine action. Every module accepts only one placement per round, even if you have markers left.",
    rules: [
      "The modules sit in a fixed row: Drive, Strike, Scan, Fabricate, Salvage, Uplink, Prime. They map to Move, Engage, Investigate, Contribute, Acquire, Assist and Recover in that order. A bare placement gives 1 effect.",
      "A placement is wired to what already stands beside it: +1 for each built module directly adjacent in the row. Building a contiguous machine therefore beats scattering markers, and each empty module shows what it would pay before you spend on it.",
      "Recover with a marker primes the next non-Move placement for +1 effect. Move preserves priming. Assist can use priming, but does not spend support received from an ally.",
      "Hold keeps a built module standing through the rebuild, so its neighbours open next round already wired. It costs a marker from next round's supply and that module stays occupied, which is the price of starting with a machine rather than a bare row.",
    ],
    growth:
      "Field experience adds a fifth marker in round 3 and a sixth in round 5. The seven modules still accept one placement each per round, so extra markers buy the reach to build a longer connected run rather than repetition. Keeping your core adds one more.",
    cooperation:
      "Build outward from what stands instead of jumping across the row, sequence Prime before Fabricate or Uplink, and request support before contributing. Placing on Fabricate at the relay uses the same module needed at the breach: another specialist can restore the relay so you keep Fabricate available.",
    example:
      "Place on Scan, then Salvage, then Fabricate between them: the third placement is worth 1 + 2 wired = 3 before anything else. Prime first and it is 2 + 2 = 4, so with the relay restored that Contribute gives 8 stabilization for 1 shared Power. Hold Scan and Salvage over and next round's Fabricate opens at 3 again, bought with two of next round's markers.",
  },
};

export function RulesReference({
  initialSeat,
  onClose,
}: {
  initialSeat: Seat;
  onClose: () => void;
}) {
  const [seat, setSeat] = useState(initialSeat);
  const identity = identities[seat];
  const rules = engineRules[seat];
  return (
    <div className="modal-backdrop">
      <section
        className="modal rules-reference"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        style={{ "--reference-color": identity.color } as CSSProperties}
      >
        <button
          className="icon-button modal-close"
          aria-label="Close rules reference"
          title="Close rules reference"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">
          <CircleHelp size={14} /> SPECIALIST RULES
        </span>
        <h2 id="rules-title">{identity.title} rules</h2>
        <label className="rules-selector">
          Specialist reference
          <select
            value={seat}
            onChange={(event) => setSeat(event.target.value as Seat)}
          >
            {missionSeats.map((role) => (
              <option key={role} value={role}>
                {identities[role].title} / {identities[role].engine}
              </option>
            ))}
          </select>
        </label>
        <section aria-label="Your engine">
          <h3>
            {identity.engine} / {identity.family}
          </h3>
          <p className="muted">{identity.flavour}</p>
          <p>{rules.kit}</p>
          <ul>
            {rules.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <h4>How your kit grows</h4>
          <p>{rules.growth}</p>
        </section>
        <section>
          <h3>Your place in the team</h3>
          <p>{rules.cooperation}</p>
          <h4>Cooperation example</h4>
          <p>{rules.example}</p>
        </section>
        <section>
          <h3>Keep your core or support the team</h3>
          <p>{identity.upgrade}</p>
          <p>
            Instead, donate the core for 2 shared Power. This permanently
            forfeits that specialist's upgrade for this mission. Each specialist
            has one core.
          </p>
        </section>
        <details className="shared-rules">
          <summary>Shared actions and team rounds</summary>
          <dl>
            <dt>One shared objective</dt>
            <dd>
              Reach {playableMission.requiredProgress} stabilization before
              instability reaches {playableMission.instabilityLimit} or round{" "}
              {playableMission.roundLimit} ends. Everyone's engine affects this
              same world.
            </dd>
            <dt>Field experience</dt>
            <dd>
              Every engine gains capability at the start of rounds 3 and 5, on
              the same clock the world escalates on. A long mission makes the
              team stronger as well as the crisis worse, so late rounds are
              worth reaching rather than only worth surviving.
            </dd>
            <dt>Move and act</dt>
            <dd>
              Select a destination and spend capability to Move there. Engage at
              West gate removes patrol strength. Investigate at the archive or
              breach reveals safe timing and, with engine pieces, produces
              Knowledge. Contribute requires being at the relay or breach.
              Assist and Acquire are not restricted by location.
            </dd>
            <dt>Relay and readings</dt>
            <dd>
              Restoring the relay costs an engine commitment and 2 shared Power,
              adds 1 instability, and doubles future breach output. Each breach
              contribution costs 1 shared Power. Combine Glitter Boy's and Ley
              Line Walker's breach readings, or Investigate, to establish safe
              timing; otherwise each breach contribution adds 5 instability.
              Sharing reveals your reading to the team and costs no piece.
            </dd>
            <dt>Shared discoveries</dt>
            <dd>
              Location assessments are private until deliberately shared.
              Glitter Boy and Juicer together expose a gate weakness: the next
              Engage there gains +1 effect. Juicer and Techno-Wizard together
              locate an archive cache: the next Investigate there using engine
              pieces also recovers 2 Power. Both discoveries are one-use team
              opportunities; any specialist may spend their own capability to
              exploit them.
            </dd>
            <dt>Assistance</dt>
            <dd>
              Request help without spending capability. Assist spends your
              capability to store bonus effect for another specialist. Their
              next effect action consumes the bonus; Move and assisting someone
              else preserve it. Received support stacks. The relay doubles it
              when used on breach stabilization.
            </dd>
            <dt>Reserves and recovery</dt>
            <dd>
              Acquire turns engine effect into a chosen shared resource. Recover
              lowers instability by your effect. With no pieces selected, spend
              1 Materiel to Recover with 1 base effect, 1 Influence to Assist
              for +1, or 1 Knowledge to Investigate unknown timing.
              Techno-Wizard's reserve-only actions do not occupy or prime
              modules. Recover adds and consumes any received support, even when
              paid with Materiel instead of pieces. Prime before receiving
              assistance if you want to save that support for stabilization.
            </dd>
            <dt>Hold versus finish</dt>
            <dd>
              There are no individual turns. Hold preserves your remaining
              capability and you may act again. Finish round forfeits further
              spending for this round, but still allows sharing and requests.
              When all four finish, the world adds instability and all engines
              refill. Opening this reference does not pause the other players.
            </dd>
            <dt>World response</dt>
            <dd>
              The breach adds 1 instability, plus 1 if any patrol strength
              remains, plus another 1 for each two rounds elapsed. The next
              response is shown on the shared board. The sixth response ends an
              unfinished mission.
            </dd>
          </dl>
        </details>
      </section>
    </div>
  );
}
