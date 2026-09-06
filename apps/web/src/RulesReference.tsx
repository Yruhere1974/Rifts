import { useState, type CSSProperties } from "react";
import { CircleHelp, X } from "lucide-react";
import { missionSeats, type Seat } from "@rifts/rules";
import { playableMission } from "@rifts/content";
import { identities } from "./EngineConsole.js";

const engineRules: Record<
  Seat,
  { kit: string; rules: string[]; cooperation: string; example: string }
> = {
  soldier: {
    kit: "Five six-sided dice each round. Allocate one available die per engine action; committed dice are spent until the next round.",
    rules: [
      "A die showing 1-3 gives 1 effect; 4-6 gives 2 effect. The face is a threshold, not the amount of damage or progress.",
      "Engage requires 4+. Assist requires 3+. Other actions accept any die. Moving costs a die regardless of its value, so low dice are useful.",
    ],
    cooperation:
      "High dice can remove patrol strength, produce shared reserves, stabilize the breach, or become support for an ally. Giving a die to Assist means it cannot also advance your own position or contribution.",
    example:
      "At the breach, a 4+ die gives 2 effect. With +2 support from an ally and the relay restored, Contribute gives (2 + 2) x 2 = 8 stabilization, costing that die and 1 shared Power. Safe timing must be known to avoid instability.",
  },
  mage: {
    kit: "Five cards each round: two Channel, two Resonance, and one Exploit Opening. Played cards leave your hand until the next round.",
    rules: [
      "Any single card gives 1 effect. One Channel plus one Resonance together gives 3 effect. No other two-card combination is valid; at most two cards can be committed.",
      "After the relay suppresses the shield, Exploit Opening gives +2 when used to Assist. Otherwise it gives 1 effect. Moving needs only one card; extra effect does not improve movement.",
    ],
    cooperation:
      "Weave cards for a strong shared contribution, or preserve Exploit Opening to support another specialist after the relay is restored. Hold keeps that response available during the same team round.",
    example:
      "Spend Exploit Opening to Assist Operator after the relay is restored: Operator stores +2 support and you lose that card. Operator's normal placement then contributes (1 + 2) x 2 = 6 stabilization at the breach, for 1 shared Power. If Operator primed before receiving your support, add another +1 before doubling. Recover after receiving support would spend that bonus on recovery instead.",
  },
  scout: {
    kit: "A fresh bag each round: six safe tokens and two hazards. Safe find, cache, and signal tokens each give 1 effect; their names do not restrict which action they can fund.",
    rules: [
      "Draw into a pending haul. The second hazard destroys that pending haul and adds 1 instability. Any tokens still in the bag can still be drawn; the risk counter resets after a bust.",
      "Bank haul secures safe tokens and ends all drawing for this round. Bank before spending. Commit one or more secured safe tokens to an action; their effects add together. Hazards cannot be spent.",
    ],
    cooperation:
      "Bank early to guarantee support or shared Power; push further for a larger contribution while risking the haul and the team's stability. Keep separate tokens for movement and later actions instead of spending everything at once.",
    example:
      "Bank three safe tokens. Spend one to Move to the breach and the other two to Contribute. With the relay restored, those two tokens give 4 stabilization for 1 shared Power. With safe timing known, no blind-work instability is added.",
  },
  operator: {
    kit: "Four placement markers each round. Commit one marker per engine action. Every module accepts only one placement per round, even if you have markers left.",
    rules: [
      "Drive = Move; Strike = Engage; Scan = Investigate; Fabricate = Contribute; Uplink = Assist; Prime = Recover; Salvage = Acquire. A normal placement gives 1 effect.",
      "Recover with a marker primes the next non-Move placement for +1 effect. Move preserves priming. Assist can use priming, but does not spend support received from an ally. Occupied modules and markers reset next round.",
    ],
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
          <h3>{identity.engine}</h3>
          <p>{rules.kit}</p>
          <ul>
            {rules.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
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
              contribution costs 1 shared Power. Share two different
              specialists' readings, or Investigate, to establish safe timing;
              otherwise each breach contribution adds 5 instability. Sharing
              reveals your reading to the team and costs no piece.
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
              for +1, or 1 Knowledge to Investigate unknown timing. Operator's
              reserve-only actions do not occupy or prime modules. Recover adds
              and consumes any received support, even when paid with Materiel
              instead of pieces. Prime before receiving assistance if you want
              to save that support for stabilization.
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
