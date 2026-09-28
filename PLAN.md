# Layoutly — Planul complet

> „Inspect din Chrome, dar care îți dă direct codul componentei și stilul site-ului, gata de lipit în orice LLM.”

## 1. Ideea (din notă)

| Din notă | Cum e implementat |
|---|---|
| 10$ lifetime | Licență unică de **$10**, plătită o singură dată, activată cu cheie (Lemon Squeezy). |
| Landing page SaaS, descărcabil pe Windows / Mac | `website/` — landing page static cu butoane de download `.dmg` (Mac Intel + Apple Silicon) și `.exe` (Windows). |
| Onboarding de 2–3 pași | 3 pași: 1) cum funcționează, 2) alegi tasta, 3) alegi stack-ul + LLM-ul. |
| Gratis: 2 elemente + 2 informații de design | **În fiecare zi** gratis: **2 componente** + **2 extrageri de stil** (per site). Nelimitat cu $10 o dată. |
| Copiezi codul și îl pui în ce LLM vrei | Format „LLM prompt” (+ HTML, CSS, fișier unic) și butoane „Copy & open ChatGPT / Claude / Gemini”. |
| Setezi în onboarding tasta | Recorder de tastă (ex. `Alt+Shift+S`, `F2`), schimbabilă din Settings. |
| Deschizi site-ul, apeși tasta, apar dreptunghiuri ca la Inspect | Browser integrat în app; tasta pornește inspectorul: overlay albastru cu tag, clasă și dimensiuni peste elementul de sub mouse. |
| Se deschide un sidebar doar cu codul componentei | Click pe element → sidebar cu codul curat (HTML + CSS calculat, doar ce contează) + screenshot. |
| Stilul site-ului: culori, fonturi | Tab „Style”: paletă de culori (cu frecvență), fonturi, mărimi de text, border-radius, umbre, variabile CSS → export CSS vars / Tailwind / prompt. |

## 2. Arhitectură

```
Layoutly (Electron, Windows + macOS)
├── src/main/            procesul principal (Node)
│   ├── main.js          fereastra, tasta globală (activă doar când app-ul are focus), IPC, securitate webview
│   ├── store.js         setări + consumul zilei în userData/layoutly.json
│   ├── license.js       activare / validare / dezactivare licență (Lemon Squeezy License API)
│   └── config.js        prețuri, gratuități pe zi, link checkout, link-uri download   ← DE COMPLETAT
├── src/preload/preload.js      puntea sigură renderer ↔ main (contextBridge)
├── src/inspector/webview-preload.js
│                        rulează în fiecare site deschis: overlay tip „Inspect”, selecție,
│                        extragere componentă (HTML + CSS computed dedublat) și design tokens
├── src/renderer/        UI-ul aplicației: bară URL, browser, sidebar, onboarding, paywall, setări
├── website/             landing page (static, se poate pune pe Vercel / Netlify / GitHub Pages)
├── test/                teste automate pentru inspector (rulează în Chromium real)
└── .github/workflows/release.yml   build automat .dmg + .exe la fiecare tag v*
```

### De ce browser integrat (și nu Chrome-ul utilizatorului)?
Un app desktop nu poate injecta cod în Chrome fără extensie. Cu un browser integrat (Chromium, prin Electron)
avem control complet: overlay, citirea stilurilor calculate, screenshot al componentei, fără permisiuni speciale
pe Mac. Extensia de Chrome poate veni ca **v2** (vezi roadmap), refolosind același `inspector`.

### Cum se extrage o componentă
1. Se parcurge sub-arborele elementului (max 400 noduri, se sar `script`, `style`, elementele `display:none`).
2. Pentru fiecare nod se citește `getComputedStyle` pentru ~90 de proprietăți relevante.
3. Se păstrează **doar** ce diferă de stilul implicit al tag-ului (comparat într-un shadow DOM izolat), iar
   proprietățile moștenite doar când diferă de părinte → CSS scurt și curat.
4. Regulile identice sunt unite într-o singură clasă (`.s-1`, `.s-2`, …); se adaugă `::before/::after` și `:hover`
   (din stylesheet-urile accesibile).
5. URL-urile (`src`, `href`, `srcset`) devin absolute ca imaginile să meargă oriunde.
6. Rezultatul: HTML, CSS, fișier unic și un **prompt pentru LLM** care cere recrearea în stack-ul ales
   (React + Tailwind, React + CSS, Vue, Svelte, Next.js, HTML/CSS).

### Cum se extrage stilul site-ului
Se scanează până la 4000 de elemente vizibile: culori text / fundal / bordură (cu frecvență), familii de fonturi
și grosimi, scara de mărimi de text, border-radius, box-shadow, variabile CSS din `:root`, fonturile încărcate
(`document.fonts`). Export: variabile CSS, config Tailwind, prompt „design system”.

## 3. Monetizare

**Model: open source + $10 pentru comoditate.** Același cod, două ediții, decise la build (`src/main/main.js`):

| | Open source — $0 | Lifetime — $10 |
|---|---|---|
| Ce e | Codul complet pe GitHub, licență **MIT** | Installer-ele gata făcute (`.dmg` / `.exe`) din Releases |
| Cum | `git clone` → `npm install` → `npm start` (sau `npm run dist:mac` pentru propriul installer) | Descarci, dai dublu-click |
| Limite | Niciuna — fără limită, fără paywall, fără cheie | Gratis 2 + 2 **pe zi**, nelimitat cu plată unică $10 |

* Ediția **oficială** = doar build-urile făcute de `release.yml`, care adaugă `layoutlyEdition: "official"` în
  `package.json`-ul împachetat (`-c.extraMetadata.layoutlyEdition=official`). Orice altceva e ediția open-source.
* De ce merge: nu vindem codul, vindem comoditatea (fără Node.js, fără terminal, installer + update-uri gata).
  Designerii și non-dev-ii plătesc $10; developerii îl rulează gratis și îl promovează (stele, fork-uri, PR-uri).
* Nu are rost DRM / anti-crack: sursa e publică. În ediția open-source, butonul „Support · $10” din Settings
  duce tot la checkout, ca donație.
* Numele „Layoutly” și logo-ul nu intră în MIT: cine redistribuie build-uri proprii trebuie să le redenumească.
* Testezi paywall-ul din sursă cu `npm run start:official`.

* **Gratis zilnic** (doar ediția oficială): 2 componente + 2 stiluri **pe zi**, resetate la miezul nopții (ora locală).
  Un stil = un site; redeschiderea aceleiași componente sau re-extragerea aceluiași site în aceeași zi nu consumă.
  Nu e un trial care expiră: app-ul rămâne util gratis, iar cine vrea mai mult pe zi plătește $10.
  Componenta se consumă la selecție (atunci apare codul). Se contorizează în `main`, nu în UI.
* **Lifetime $10**: plată unică prin **Lemon Squeezy** (merchant of record → se ocupă de TVA în UE, facturi, carduri, PayPal).
  Lemon Squeezy generează automat cheia de licență, iar app-ul o activează prin API-ul public
  `https://api.lemonsqueezy.com/v1/licenses/activate` (nu necesită secret în aplicație).
* Limită recomandată: **3 activări / licență** (setare în Lemon Squeezy) — utilizatorul poate dezactiva din Settings.
* Validare la pornire; dacă nu e internet, licența rămâne activă (fără să enerveze clienții plătitori).

## 4. Ce trebuie să faci tu (checklist de lansare)

1. **Lemon Squeezy**
   - [ ] Cont + store, produs „Layoutly Lifetime” la **$10**, tip *single payment*.
   - [ ] Activează *License keys* pe produs, limită 3 activări, fără expirare.
   - [ ] Copiază link-ul de checkout în `src/main/config.js` → `checkoutUrl` și în `website/config.js`.
   - [ ] (Opțional, recomandat) pune `productId` în `config.js` ca o cheie de la alt produs să nu fie acceptată.
2. **Build & distribuție** (automat, în repo-ul public `contactiordache-code/Layoutly`)
   - [x] Creezi repo-ul public gol `Layoutly` și dai acces aplicației Claude pe GitHub la el.
   - [x] Publici sursa acolo **cu istoric curat** — nu face public `SEITON.CRM`, istoricul lui conține
         vechiul CRM (Supabase etc.). După ce ai comis tot pe `main`, un singur commit nou, fără istoric:
         ```bash
         git checkout --orphan public && git commit -m "Layoutly: open source (MIT)"
         git push https://github.com/contactiordache-code/Layoutly.git public:main
         git checkout main && git branch -D public
         ```
         Din acel moment repo-ul public e casa proiectului: sursă, Releases, GitHub Pages.
   - [x] La fiecare tag `v*`, GitHub Actions construiește `Layoutly-mac-arm64.dmg`, `Layoutly-mac-x64.dmg`,
         `Layoutly-win-x64.exe` și le publică în Releases (fără semnare Apple, macOS primește semnătură ad-hoc).
   - [ ] Activezi GitHub Pages pe repo: Settings → Pages → Source: **GitHub Actions**, apoi rulezi din nou workflow-ul „Deploy landing page”.
   - [x] Landing page-ul se publică automat pe GitHub Pages: `https://contactiordache-code.github.io/Layoutly/`.
   - [x] Butoanele de download duc la `releases/latest/download/...`, deci fiecare versiune nouă apare automat.
   - Versiune nouă: crești `version` în `package.json`, apoi `git tag vX.Y.Z && git push --tags`.
3. **Semnare cod** (altfel apar avertismente la instalare)
   - [ ] macOS: Apple Developer ($99/an) → certificat „Developer ID Application” + notarizare
         (secrete `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` în GitHub).
   - [ ] Windows: certificat de code signing (ex. Azure Trusted Signing ~ $10/lună) sau acceptă SmartScreen la început.
4. **Landing page**
   - [ ] (Opțional) domeniu propriu (ex. `layoutly.app`) legat la GitHub Pages.
   - [ ] Pune link-urile reale în `website/config.js`.
   - [x] Termeni + politică de confidențialitate: `website/terms.html`, `website/privacy.html` (draft — citește-le și ajustează-le).

## 5. Roadmap

**v0.1 (acest commit — MVP complet)**
- [x] App desktop Electron Windows + Mac cu browser integrat
- [x] Onboarding 3 pași cu recorder de tastă
- [x] Inspector tip Chrome (hover, săgeți ↑/↓ pentru părinte/copil, Enter/click selectează, Esc iese)
- [x] Sidebar cu cod componentă (LLM prompt / HTML / CSS / fișier unic) + screenshot
- [x] Tab Style: culori, fonturi, text, radius, umbre, variabile CSS → CSS vars / Tailwind / prompt
- [x] Gratis 2 + 2 pe zi și paywall, activare licență Lemon Squeezy
- [x] Landing page cu download Mac / Windows și pricing $10
- [x] Build automat prin GitHub Actions
- [x] Teste automate ale inspectorului

**v0.2**
- [ ] Auto-update (`electron-updater`) — din Releases
- [ ] Istoric componente copiate (local) + favorite
- [ ] Conversie directă în Tailwind fără LLM
- [ ] ~~Trial legat de ID-ul mașinii pe server (anti-reset)~~ — renunțat: sursa e liberă, oricine poate rula fără limite

**v0.3**
- [ ] Extensie Chrome care refolosește `webview-preload.js` și trimite în app
- [ ] Export imagini/iconițe SVG din componentă
- [ ] Variante: mobile / tablet (emulare viewport înainte de extragere)

## 6. Marketing (pe scurt)
- Public: indie hackers, designeri care folosesc Cursor / v0 / Lovable / Bolt, freelanceri web.
- Mesaj: „Vezi un buton / card / hero care îți place? O tastă → e în ChatGPT / Claude / Cursor.”
- Canale: Product Hunt, X / Twitter (demo video 20s), Reddit (r/webdev, r/SideProject), TikTok cu „recreez site-ul X în 30s”.
- Prețul de $10 lifetime e argumentul principal → „mai ieftin decât un prânz”.
