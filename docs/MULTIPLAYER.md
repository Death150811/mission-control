# Team mode and multiplayer architecture

## What is implemented
* Rooms identified by a 4-letter code, up to four members, four roles (Mission Director, Spacecraft Engineer, Science Officer, Flight Operations Officer) or "solo: all roles".
* **Real synchronisation between tabs / windows of the same browser** using the `BroadcastChannel` API: shared design state, presence (heartbeat every 2 s, stale members dropped after 7 s), the subsystem a member is currently editing, a decision history and approval requests.
* Role permissions are enforced in the Workshop, Instrument Lab, Orbit Planner and Launch Center.
* Optional approval gate: when enabled, non-director roles must request launch / launch-vehicle approval and the Director approves or rejects.

Verified manually: two tabs joined the same room code and each listed the other as a member.

## What is NOT implemented
* Internet multiplayer. There is no server in this build and nothing is sent off the device. The UI says so.
* Conflict resolution beyond last-writer-wins on the design object.

## How a real backend plugs in
`src/store/team.ts` defines `TeamTransport { send, onMessage, close }` and the `TeamMessage` union. A Supabase Realtime implementation would:
1. create a channel `room:<code>` with broadcast and presence enabled;
2. implement `send` with `channel.send({ type: 'broadcast', event: 'msg', payload })` and `onMessage` with `channel.on('broadcast', { event: 'msg' }, ...)`;
3. replace the heartbeat with `channel.track(member)` presence;
4. persist `design` and `decisions` in a `rooms` table (row-level security by room code) so late joiners do not depend on the `hello` → `sync` handshake;
5. use Supabase Auth if identities are required.

No other code needs to change.
