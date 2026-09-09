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
      "Any single card gives 1 effect. One Channel plus one Resonance together gives 3 effect. No other two-card combination is valid; at most two cards can be committed.",
      "After the relay suppresses the shield, Exploit Opening gives +2 when used to Assist. Otherwise it gives 1 effect. Moving needs only one card; extra effect does not improve movement.",
    ],
    growth:
      "Field experience adds a Channel in round 3 and a Resonance in round 5, so the hand reaches seven cards. Each addition is another possible weave in the same round rather than a stronger single card. Keeping your core raises every weave to 4 effect.",
    cooperation:
      "Weave cards for a strong shared contribution, or preserve Exploit Opening to support another specialist after the relay is restored. Hold keeps that response available during the same team round.",
    example:
      "Spend Exploit Opening to Assist Techno-Wizard after the relay is restored: Techno-Wizard stores +2 support and you lose that card. Techno-Wizard's normal placement then contributes (1 + 2) x 2 = 6 stabilization at the breach, for 1 shared Power. If Techno-Wizard primed before receiving your support, add another +1 before doubling. Recover after receiving support would spend that bonus on recovery instead.",
  },
  bag: {
    kit: "A fresh bag each round: six safe tokens and two hazards. Safe find, cache, and signal tokens each give 1 effect; their names do not restrict which action they can fund.",
    rules: [
      "Push to add a hidden token to your surge. A hazard destroys the whole surge and costs the team one instability for every token lost, plus one for each burnout already taken this round. Busting with an empty hand risked nothing, so it costs nothing.",
      "A hazard goes back into the bag; safe tokens leave it when drawn. The odds therefore only ever get worse within a round, and the band above the Push button reports them before each push.",
      "Committing an action spends your entire surge, so push to the size the action deserves. Move once, contribute hard. With no surge you can still spend a shared resource, exactly like the other engines.",
    ],
    growth:
      "Field experience adds a jackpot to the bag in round 3 and another in round 5, and never removes a hazard. Later pushes pay more without becoming safer, which is the point. Keeping your core converts one hazard into a jackpot as well.",
    cooperation:
      "Every action is its own decision about how far to push. A small surge for a move keeps the bag alive for a larger contribution later; one long push can produce the team's biggest single effect, or cost the round and raise instability where everyone can see it.",
    example:
      "Push three times without a hazard, then Contribute at the breach. With the relay restored that surge gives 6 stabilization for 1 shared Power. Pushing a fourth time to reach 8 risks the entire surge on odds the console shows you first.",
  },
  systems: {
    kit: "Four placement markers each round. Commit one marker per engine action. Every module accepts only one placement per round, even if you have markers left.",
    rules: [
      "Drive = Move; Strike = Engage; Scan = Investigate; Fabricate = Contribute; Uplink = Assist; Prime = Recover; Salvage = Acquire. A normal placement gives 1 effect.",
      "Recover with a marker primes the next non-Move placement for +1 effect. Move preserves priming. Assist can use priming, but does not spend support received from an ally. Occupied modules and markers reset next round.",
    ],
    growth:
      "Field experience adds a fifth marker in round 3 and a sixth in round 5. The seven modules still accept one placement each per round, so extra markers buy breadth across modules rather than repetition. Keeping your core adds one more.",
    cooperation:
      "Sequence Prime before Fabricate or Uplink, and request support before contributing. Placing on Fabricate at the relay uses the same module needed at the breach: another specialist can restore the relay so you keep Fabricate available.",
    example:
      "Move to the breach, place on Recover to prime, then receive +2 support. Your Contribute placement gives (1 + 1 priming + 2 support) x 2 = 8 stabilization with the relay restored, for 1 shared Power. This spends three markers across three different modules.",
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
