# Jatkokehitys – tästä jatketaan

## Tilanne (25.10.2026)
- Demo valmis: `npm install` + `npm run dev` → http://localhost:5173/
- 122 yksikkötestiä menee läpi (`npm test`), tyyppitarkistus ja build kunnossa.
- **Ensimmäinen kokeilu oikealla soittimella (piano):** sointua ei aina tunnistettu. Piti soittaa "yliselkeästi", ennen kuin sovellus huomasi soinnun.
- **Pääkäyttö tulee olemaan uruilla**, nyt testattiin pianolla. Korjausten pitää toimia molemmilla.
- **Uutta:** *Asetukset → Testinäytteet* tallentaa mikrofonin spektrit ja tiedon soitetusta soinnusta. Kehityspalvelimessa (`npm run dev`) näyte menee suoraan kansioon `samples/`. Muuten se ladataan tiedostona, joka siirretään samaan kansioon.

## Julkaisu
- Verkossa: **https://eliaspohjonen03-lang.github.io/Modulaatiotreeni/** (GitHub Pages, julkinen repo `eliaspohjonen03-lang/Modulaatiotreeni`).
- Jokainen `git push` main-haaraan ajaa testit ja julkaisee uuden version automaattisesti (`.github/workflows/deploy.yml`).
- Push toimii SSH:lla. Muutoshistoriassa tekijänä on käyttäjänimi ja GitHubin piilo-osoite (asetettu vain tähän repoon).
- `samples/` ei ole repossa (`.gitignore`), vaan näytteet ovat vain tällä koneella. Näytetestit ajetaan siksi vain paikallisesti.
- iPhonella ei ole vielä testattu. Tarkistettavaa: äänimerkki äänettömällä, herkkyys, näytön pysyminen päällä. iPhonella tallennetut näytteet menevät Tiedostot-sovellukseen, josta ne siirretään `samples/`-kansioon.

## Tehty 25.10.2026: tempo, aloitusnäyttövihje, metronomin ääni
- Soittonäkymässä on tempon säädin (− liukusäädin +), kun metronomi on päällä (`src/ui/TempoBar.tsx`).
- Puhelimen selaimessa näytetään kerran vihje aloitusnäytölle lisäämisestä (`src/ui/InstallHint.tsx`).
- Metronomin ääni on puukapulamainen (n. 2,5 kHz, `src/audio/metronome.ts`). Simulaatio oikeilla pianonäytteillä: tunnistus muuttui alle 1 %:ssa kehyksistä. Kysy kaverilta, miltä ääni kuulostaa ja häiritseekö se tunnistusta oikeassa käytössä.
- Kaveri harkitsee linkin jakamista koulussaan. Sovellus ei kerää tietoja, joten tämä on ok. Muista, että päivitykset menevät kaikille yhtä aikaa.

## Avoimet kysymykset kaverille
- Tuntuvatko vinkkien sointureitit urkurin korvaan luontevilta?
- Toimiiko tunnistus iPhonen mikrofonilla ja uruilla?
- Miltä uusi metronomin ääni kuulostaa?

## Tehty: lähtösävellaji valitaan tai soitetaan
- Oletuksena (`startKey: "ask"`) sovellus kysyy aloitettaessa "Mistä lähdetään?". Vastaukseksi kelpaa ruudukko, arvonta tai soitettu vakaa duuri- tai mollisointu (`keyFromChord`, `engine.onStableChord`). Ensimmäinen tavoite arvotaan heti siitä (`PracticeSession.startFrom`).
- Etäisyystasot ovat monivalinta (`distances`). Asetukset ovat versiossa `SETTINGS_VERSION` 5.

## Tehty: modulaatiovinkit ja uusi vaikeustaso
- **Vinkki-nappi** (lamppu, ruudun keskellä tavoitteen alla) avaa sointureitin edellisestä sävellajista uuteen. Helpoin reitti näytetään ensin, ja "＋ Toinen tapa" näyttää seuraavan. Reitit lasketaan säännöillä (`src/music/modulation.ts`), ja testit käyvät läpi kaikki sävellajiparit.
- **Asetukset:** "Sävellajit mukana" (24 valintaa + etumerkkipikavalinnat) ja "Vaikeustaso: modulaation etäisyys" (Lähi 0–1, Keski 2–3, Kaukainen 4–6 askelta kvinttiympyrällä). Vanha etumerkkitaso siirtyy automaattisesti sävellajivalinnaksi (`SETTINGS_VERSION` 3).
- Pyydä kanttorikaverilta palautetta reittien musiikillisesta luontevuudesta. Järjestystä säädetään `rank`-arvoilla.

## Tehty 24.10.2026 illalla: ensimmäiset pianonäytteet
- 9 pianonäytettä: C, G7, Am, F, D, kadenssi C-duurissa, kadenssi D-duurissa ("ei yliselkeästi") ja 2 × hiljaisuus.
- **Syy "yliselkeästi soittamiseen" löytyi:** yläsävelvähennys (60 %) poisti oikeasti soitetun kvintin. Esim. C3–C4–E4–G4: G4 tulkittiin C3:n 3. osasäveleksi ja nollattiin. Sointu jäi pelkäksi C+E:ksi, pisteet olivat juuri ja juuri rajan (0,78) yläpuolella, ja pianon vaimetessa sointu katosi.
- **Korjaus:** `harmonicSuppression`-oletus 0.6 → 0 (`src/music/chroma.ts`). C-kadenssin kehyksistä tunnistui ennen 45/139, nyt 139/139. Muut näytteet pysyivät ennallaan tai paranivat, eikä hiljaisuudesta tullut vääriä sointuja. Synteettiset urkutestit (mikstuura, 16' pedaali) menevät läpi.
- Selaimeen tallennetut vanhat asetukset siirtyvät automaattisesti uuteen oletukseen (`SETTINGS_VERSION` 2, `src/settings.ts`).
- Kokeiltu ilman hyötyä: kromagrammin kompressio (neliöjuuri tms.). Muita kynnyksiä (`minChordScore`, `agreement`) ei tarvinnut muuttaa.
- Kadenssi- ja hiljaisuusnäytteet ovat nyt regressiotestejä (`samples.test.ts`, taulukko `CADENCES`). Testi tarkistaa myös, ettei sointu katoa sointujen välissä.

## Seuraava askel: urkunäytteet
Pianon osalta perussarja on kerätty. **Seuraavaksi tarvitaan urkunäytteitä.** Urkujen yläsävelvähennys on nyt 0, ja se on varmistettu vain synteettisellä datalla. Jos mikstuurat aiheuttavat vääriä sointuja, tarvitaan todennäköisesti fiksumpi vähennys: sellainen, joka ei syö oikeita kvinttejä, tai soitinkohtainen asetus. Ohjeet alla.

## Näytteiden keruuohje
Tavoite on 15–30 näytettä. Jokainen kestää 5 s, ellei toisin mainita. Tallennuksen jälkeen sovellus kertoo heti, tunnistiko se soinnun.

**Piano** (soitin: Piano, kuvaukseen esim. "pianino" tai "flyygeli, oikea pedaali"):
1. C, G7, a-molli, F ja D keskirekisterissä, tiivis äänenkuljetus. Lyö kerran ja anna soida.
2. Samat soinnut niin, että basso on vasemmassa kädessä (laaja äänenkuljetus).
3. Pari sointua ilman pedaalia ja lyhyesti soitettuna.
4. Vapaa soitto 10 s: kadenssi I–IV–V7–I normaalitempossa, kirjoita kenttään mitä soitit.
5. **Tärkein:** soita juuri niin kuin soitit, kun tunnistus ei toiminut.

**Urut** (soitin: Urut, kirjoita äänikerrat):
1. Samat soinnut kuin pianolla, ainakin kolmella registroinnilla:
   - pelkkä 8' huilu tai principal
   - 8' + 4'
   - plenum mikstuuralla ja 16' pedaalibasso
2. Kadenssi vapaana soittona 10 s jokaisella registroinnilla.

**Hiljaisuus:** yksi 3 s:n "vapaa soitto" -näyte, jossa ei soiteta mitään. Siitä nähdään huoneen ja mikrofonin kohinataso.

## Näin näytteitä käytetään (Claudelle)
- `npm run samples` tulostaa jokaisesta näytteestä tunnistusosuuden, viiveen vakaaseen sointuun ja vakaiden sointujen jonon.
- Asetuksia voi kokeilla muuttamatta koodia, esim. `npm run samples -- --minChordScore=0.7 --agreement=0.6 --harmonicSuppression=0.3`.
- `npm run samples -- --frames=<osa tiedostonimestä>` näyttää kehyskohtaisesti tason, basson, tunnistuksen ja kromagrammin.
- `npm test` ajaa jokaisen sointunäytteen regressiotestinä (`src/music/__tests__/samples.test.ts`) oletusasetuksilla. Säädä asetuksia niin, että sekä piano- että urkunäytteet menevät läpi.
- Muista: käyttäjän asetukset tallentuvat localStorageen kokonaisuudessaan. Jos `harmonicSuppression`- tai `minChordMs`-oletus muuttuu, vanhat tallennetut arvot jäävät voimaan. Kasvata silloin `SETTINGS_VERSION` ja lisää migraatio `loadSettings`-funktioon (`src/settings.ts`).

## Muita korjausideoita (jos urkunäytteet tai uudet pianonäytteet paljastavat ongelmia)
1. ~~Yläsävelvähennys syö oikeita sointusäveliä~~ → korjattu (oletus 0). Jos urut tarvitsevat vähennystä, rajaa se tilanteisiin, joissa yläsävel on selvästi perussäveltä heikompi tai sopii soittimen sointiin.
2. `minChordScore` 0.78 ja vakautuksen `agreement` 0.75: nykyiset näytteet eivät vaatineet muutosta.
3. Piano: äänet vaimenevat nopeasti. Tarvittaessa voi lisätä "sustain-pidon", joka muistaa viimeisen soinnun hetken.
4. Huippujen poiminta (±50 senttiä) voi ohittaa sävelen, jos viritys tai epäharmonisuus siirtää huippua.
