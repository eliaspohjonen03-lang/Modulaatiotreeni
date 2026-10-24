import { useState } from "react";

const DISMISSED_KEY = "modulaatiotreeni.installHintDismissed";

type Platform = "ios" | "android" | null;

/** Selaimessa (ei aloitusnäytön kuvakkeesta) avattu puhelinversio. */
function detectPlatform(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  if (standalone) return null;
  const ua = navigator.userAgent;
  // iPadOS esittäytyy Macina, mutta sillä on kosketusnäyttö.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Kertaluonteinen vihje: lisää sovellus aloitusnäytölle, niin se aukeaa koko ruudulle. */
export function InstallHint() {
  const [platform] = useState(detectPlatform);
  const [hidden, setHidden] = useState(isDismissed);
  if (!platform || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Ei tallennusta (esim. yksityinen selaus): vihje voi näkyä uudelleen seuraavalla kerralla.
    }
  };

  return (
    <aside className="install-hint" role="note">
      <p>
        <span aria-hidden>💡 </span>
        Lisää Modulaatiotreeni aloitusnäytölle, niin se aukeaa koko ruudulle kuin oikea sovellus.{" "}
        {platform === "ios" ? (
          <>Paina <b>Jaa</b>-painiketta (neliö, josta nuoli ylös) ja valitse <b>Lisää Koti-valikkoon</b>.</>
        ) : (
          <>Avaa selaimen valikko <b>⋮</b> ja valitse <b>Lisää aloitusnäytölle</b> tai <b>Asenna sovellus</b>.</>
        )}
      </p>
      <button className="btn" onClick={dismiss}>Selvä</button>
    </aside>
  );
}
