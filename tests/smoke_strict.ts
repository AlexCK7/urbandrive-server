/* tests/smoke_strict.ts
   Run with:  npm run smoke:strict
   BASE env var overrides autodetect, e.g.: BASE=https://abcd123.ngrok-free.app npm run smoke:strict
*/

type J = Record<string, any>;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function resolveBase(): Promise<string> {
  const fromEnv = process.env.BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // try ngrok API first
  try {
    const r = await fetch("http://127.0.0.1:4040/api/tunnels");
    if (r.ok) {
      const j = await r.json() as J;
      const url: string | undefined = j.tunnels?.find((t: J) => t.public_url?.startsWith("https"))?.public_url;
      if (url) return url.replace(/\/$/, "");
    }
  } catch {}

  return "http://localhost:3001";
}

async function fetchJSON(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const txt = await r.text();
  let body: any = undefined;
  try { body = txt ? JSON.parse(txt) : undefined; } catch { body = txt; }
  return { status: r.status, ok: r.ok, body };
}

function assert(ok: any, msg: string) {
  if (!ok) throw new Error(msg);
}

async function main() {
  const BASE = await resolveBase();
  console.log("✔ BASE =", BASE);

  const adminEmail = "smoke-admin@example.com";
  const userEmail  = "smoke-user@example.com";
  const driverEmail= "smoke-driver@example.com";

  // 0) Health
  {
    const r = await fetchJSON(`${BASE}/health`);
    console.log("Health:", r.status, r.body);
    assert(r.ok && r.body?.status === "ok", "Health failed");
  }

  // 1) Ensure accounts exist (idempotent)
  for (const [email, role] of [[adminEmail,"admin"], [userEmail,"user"], [driverEmail,"driver"]] as const) {
    const r = await fetchJSON(`${BASE}/api/users/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: email.split("@")[0], email, role })
    });
    if (r.ok) {
      console.log(`Signup ${email}: created`);
    } else if (r.status === 409 || (typeof r.body === "string" && /exists/i.test(r.body))) {
      console.log(`Signup ${email}: already exists (ok)`);
    } else {
      throw new Error(`Signup ${email} failed: ${r.status} ${JSON.stringify(r.body)}`);
    }
  }

  // 2) Login sanity
  for (const email of [adminEmail, userEmail, driverEmail]) {
    const r = await fetchJSON(`${BASE}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "any" })
    });
    assert(r.ok && r.body?.user?.email === email, `Login failed for ${email}`);
  }
  console.log("✔ Logins OK");

  // 3) User books a ride
  let rideId: number;
  {
    const r = await fetchJSON(`${BASE}/api/rides`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-email": userEmail },
      body: JSON.stringify({ origin: "SmokeVille", destination: "TestTown", sharedWithEmail: null })
    });
    assert(r.ok && r.body?.id, "Ride create failed");
    rideId = r.body.id;
    console.log("✔ Ride created: id=", rideId);
  }

  // 4) Non-admin cannot list all rides
  {
    const r = await fetchJSON(`${BASE}/api/rides`, { headers: { "x-user-email": userEmail } });
    assert(r.status === 403, "Expected 403 for non-admin rides list");
    console.log("✔ Non-admin forbidden OK");
  }

  // 5) Admin lists rides
  {
    const r = await fetchJSON(`${BASE}/api/rides`, { headers: { "x-user-email": adminEmail } });
    assert(r.ok && Array.isArray(r.body?.rides), "Admin list rides failed");
    console.log("✔ Admin can list rides");
  }

  // 6) Admin assigns driver
  {
    const r = await fetchJSON(`${BASE}/api/rides/${rideId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-email": adminEmail },
      body: JSON.stringify({ driverEmail })
    });
    assert(r.ok, "Assign driver failed");
    console.log("✔ Assigned driver");
  }

  // 7) User shares ride
  {
    const r = await fetchJSON(`${BASE}/api/rides/${rideId}/share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-email": userEmail },
      body: JSON.stringify({ friendEmail: "friend@example.com" })
    });
    assert(r.ok, "Share ride failed");
    console.log("✔ Shared ride");
  }

  // 8) Driver views assigned rides (should include rideId)
  {
    const r = await fetchJSON(`${BASE}/api/rides/driver`, {
      headers: { "x-user-email": driverEmail }
    });
    assert(r.ok && Array.isArray(r.body?.rides), "Driver rides failed");
    const ids = r.body.rides.map((x: any) => x.id);
    assert(ids.includes(rideId), "Assigned ride missing for driver");
    console.log("✔ Driver sees assigned ride");
  }

  // 9) Driver completes ride
  {
    const r = await fetchJSON(`${BASE}/api/rides/${rideId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-email": driverEmail }
    });
    assert(r.ok, "Complete ride failed");
    console.log("✔ Ride completed");
  }

  // 10) Admin confirms status completed
  await sleep(200);
  {
    const r = await fetchJSON(`${BASE}/api/rides`, { headers: { "x-user-email": adminEmail } });
    assert(r.ok && Array.isArray(r.body?.rides), "Admin list rides after complete failed");
    const found = r.body.rides.find((x: any) => x.id === rideId);
    assert(found && found.status === "completed", "Ride not completed according to admin list");
    console.log(`✔ Ride ${rideId} is completed ✅`);
  }

  console.log("\n🎉 Strict smoke finished successfully.");
}

main().catch((e) => {
  console.error("\n❌ Strict smoke FAILED:", e.message || e);
  process.exit(1);
});
