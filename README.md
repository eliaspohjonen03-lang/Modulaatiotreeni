# Modulaatiotreeni

Harjoitussovellus urkureille ja pianisteille: soitat vapaata improvisaatiota, sovellus kuuntelee mikrofonilla ja näyttää isolla sävellajin, johon pitää moduloida. Kun soitat tavoitesävellajissa kadenssin **V (tai V7) → I**, sovellus soittaa äänimerkin, kehuu ja vaihtaa seuraavan tavoitteen. Asetuksista voi valita myös helpomman tavan, jossa pelkkä tavoitesävellajin tonikasointu riittää.

Kaikki toimii selaimessa paikallisesti. Ei palvelinta, ei kirjautumista.

## Käynnistys

Tarvitset Node.js:n (versio 20 tai uudempi).

```bash
npm install
npm run dev
```

Avaa selaimessa osoite, jonka Vite tulostaa (yleensä <http://localhost:5173>). Paina **Aloita kuuntelu** ja anna selaimelle lupa käyttää mikrofonia.

Muut komennot:

| Komento | Mitä tekee |
|---|---|
| `npm test` | Ajaa yksikkötestit (Vitest), myös tallennetut testinäytteet |
| `npm run samples` | Näyttää, miten tunnistus toimii jokaisella testinäytteellä |
| `npm run build` | Tyyppitarkistus ja tuotantoversio kansioon `dist/` |
| `npm run preview` | Näyttää tuotantoversion paikallisesti |

## Käyttö

- **Harjoitusnäkymässä** näkyy tavoitesävellaji (esim. *Fis-duuri*, *es-molli*). Vasemmassa yläkulmassa on pieni tasomittari ja metronomin tila. Metronomin tilaa napauttamalla metronomi menee päälle tai pois.
- **Vinkki-napista** (lamppu) aukeaa sointureitti edellisestä sävellajista uuteen. Ensin näytetään helpoin reitti, ja *＋ Toinen tapa* näyttää seuraavan tekniikan: yhteinen sointu, napolilainen sointu, samannimisen sävellajin kautta, vähennetty septimisointu, tritonussijainen tai suoraan dominanttiin. Vinkki piiloutuu, kun uusi tavoite tulee.
- **Tempo:** kun metronomi on päällä, soittonäkymän alareunassa on liukusäädin ja − / + -napit tempon säätöön. Uusi tempo tulee voimaan seuraavalla iskulla.
- **Aloitusnäyttö:** puhelimen selaimessa (iPhone, iPad, Android) näytetään kerran vihje sovelluksen lisäämisestä aloitusnäytölle. *Selvä*-napin jälkeen vihjettä ei enää näytetä.
- **Rataskuvakkeesta** aukeavat asetukset: mukana olevat sävellajit, vaikeustaso (modulaation etäisyys kvinttiympyrällä), lähtösävellaji, metronomi, mikrofonin herkkyys, viritys, soinnun minimikesto, yläsävelten vaimennus, äänimerkki ja testitila.
- **Sävellajit mukana:** valitse yksittäisiä duureja ja molleja tai käytä pikavalintoja etumerkkien mukaan (0–2, 3–4, 5–6, kaikki). Enharmoniset sävellajit (Fis/Ges, dis/es) ovat yksi valinta.
- **Vaikeustaso** kertoo, kuinka kaukana seuraava tavoite on edellisestä kvinttiympyrällä: Lähi 0–1 askelta, Keski 2–3, Kaukainen 4–6 (6 = tritonus). Tasoja voi valita useamman, esim. Lähi + Keski. Jos valituista sävellajeista ei löydy sopivan etäistä, valitaan lähin.
- **Lähtösävellaji:** kun painat *Aloita kuuntelu*, sovellus kysyy "Mistä lähdetään?". Valitse sävellaji ruudukosta tai soita soittimella duuri- tai mollisointu ja pidä sitä hetki. Ensimmäinen tavoite arvotaan heti siitä eteenpäin. Asetuksista lähtösävellajiksi voi myös asettaa kiinteän sävellajin tai arvonnan, jolloin ensimmäinen tavoite on lähtösävellaji itse ja kierre alkaa sen kadenssista. *Aloita alusta* -napista kierre alkaa uudelleen.
- Asetukset tallentuvat selaimen localStorageen.

### Testitila (ilman soitinta)

Asetukset → Kehitys → **Testitila**. Harjoitusnäkymän alareunaan tulee näyttöpiano ja tavoitesävellajin sointupikanapit (I, ii, IV, V, V7 …). Soinnut "soivat" niin kauan, kunnes valitset toisen soinnun tai painat *Hiljaa*. Näyttöpianon koskettimet ovat päälle/pois-kytkimiä. Matalin painettu sävel on basso. **Soita kadenssi** -nappi soittaa automaattisesti I–IV–V7–I (mollissa i–iv–V7–i). Testitilassa näkyvät myös tunnistettu sointu ja sävellajiarvio. Testitilassa sointuja ei kuulu ääneen.

### Testinäytteet

Asetukset → **Testinäytteet**. Valitse soitin, kirjoita äänikerrat ja valitse sointu, jonka soitat. Paina sitten *Tallenna* ja soita heti. Sovellus tallentaa mikrofonin spektrit 3–10 sekunnin ajalta ja kertoo saman tien, tunnistiko se soinnun. Kun kehityspalvelin on käynnissä (`npm run dev`), näyte tallentuu kansioon `samples/`. Muuten se ladataan tiedostona, joka siirretään samaan kansioon. Näytteistä tulee yksikkötestejä, ja niiden avulla tunnistusta säädetään. Ks. `JATKOKEHITYS.md`.

## Mikrofonin säätö

1. Asetukset → Mikrofoni ja viritys → *Käynnistä mikrofoni tasomittaria varten*.
2. Ole hiljaa: palkin pitää jäädä keltaisen pystyviivan (kynnyksen) vasemmalle puolelle.
3. Soita normaalilla voimakkuudella: palkin pitää muuttua vihreäksi ja ylittää kynnys selvästi.
4. Säädä **kynnystasoa** tarvittaessa. Jos kirkon taustahäly ylittää kynnyksen, nosta sitä. Jos hiljainen rekisteröinti ei ylitä sitä, laske sitä.

Vinkkejä:
- Selaimen kaiunpoisto, kohinanvaimennus ja automaattinen äänenvoimakkuuden säätö on kytketty pois, koska ne vääristävät musiikkia.
- **Soinnun minimikesto** (oletus 400 ms): kaikuisassa kirkossa 500–700 ms vähentää vääriä tunnistuksia, koska edellinen sointu soi tilassa vielä hetken. Nopeassa soitossa voit kokeilla 250–300 ms.
- **Yläsävelten vaimennus** (oletus 60 %): jos mikstuurat tai kvinttiäänikerrat (2 2/3', 1 1/3') saavat sovelluksen kuulemaan vääriä sointuja, nosta arvoa. Jos taas soinnun kvintti tai terssi "katoaa", laske sitä.
- *Näytä tunnistustiedot* -asetus näyttää harjoitusnäkymässä, minkä soinnun ja sävellajin sovellus kuulee. Siitä on apua säätämisessä.

## Vireen kalibrointi

Kaikkia urkuja ei ole viritetty A = 440 Hz:iin. Viritys säädetään kohdassa Asetukset → Mikrofoni ja viritys:

- **Käsin:** liukusäädin välillä 415–446 Hz, ja pikanapit 415, 435, 440, 442 ja 443.
- **Automaattisesti:** valitse *Kalibrointisävel* (oletus A), paina **Kalibroi automaattisesti** ja soita heti noin 3 sekunnin ajan pitkä, tasainen sävel. Kalibrointisävelen voi soittaa missä oktaavissa tahansa. Uruilla kannattaa käyttää yhtä hiljaista perusäänikertaa (esim. 8' huilu, ei mikstuuroja). Sovellus laskee perustaajuuden ja asettaa A4:n sen perusteella.

Kalibrointi olettaa, että soittimen viritys on 415–446 Hz:n välillä. Jos tulos on alueen ulkopuolella, se hylätään, koska silloin on todennäköisesti soitettu väärä sävel.

## Miten tunnistus toimii (lyhyesti)

Musiikkilogiikka on kansiossa `src/music/`, eikä se riipu käyttöliittymästä. Testit ovat kansiossa `src/music/__tests__/`.

1. **Kromagrammi** (`chroma.ts`): FFT (16 384 näytettä) → sävelkohtaiset spektrihuiput viritystaajuuden mukaan välillä C2–C7 → **ei-oktaavisten yläsävelten vähennys** (3., 5., 6. ja 7. osasävel, eli kvintti ja terssi, joita mikstuurat korostavat) → 12 sävelluokan energiat, joissa perussävelten alue painottuu. **Basso** on matalin selkeä sävel.
2. **Ajallinen tasoitus** ja **vakautus** (`stabilizer.ts`): sointu hyväksytään vasta, kun se on ollut vallitseva vähintään minimikeston ajan.
3. **Sointutunnistus** (`chords.ts`): vertailu pohjiin duuri, molli, dominanttiseptimi, vähennetty, maj7 ja m7. Basso ratkaisee tasatilanteet.
4. **Sävellajiarvio** (`keyEstimate.ts`): Krumhansl–Schmuckler. Sävelluokkahistogrammin vanhat havainnot vaimenevat (puoliintumisaika 8 s).
5. **Kadenssi** (`cadence.ts`, `tracker.ts`): tavoitteen V tai V7 ja heti perään I (mollissa duuri-V/V7 ja sen jälkeen i). Välissä saa olla lyhyt tauko (alle 1,5 s), mutta ei muuta sointua. Lisäksi tavoitesävellajin täytyy olla sävellajiarviossa tukevasti läsnä (korrelaatio vähintään 0,5 ja enintään 0,15 parhaasta). Jos V–I on soitettu, mutta tuki vakiintuu vasta, sovellus odottaa tonikan soidessa enintään 1,5 s.
6. **Sävellajin arvonta** (`keys.ts`): etumerkkien määrän mukaan (Helppo 0–2, Keski 3–4, Vaikea 5–7, Kaikki). Uusi tavoite ei ole sama kuin nykyinen eikä mikään kolmesta edellisestä. Enharmoniset sävellajit (Fis-/Ges-duuri) lasketaan samaksi.

### Metronomi ja tunnistus

Metronomin ääni muistuttaa puukapuloita: lyhyt (n. 30 ms) puinen kopsahdus noin 2,5 kHz:ssä, korostettu isku hieman korkeampi (2,8 kHz). Se on analysoitavan sävelalueen (enintään C7 ≈ 2,1 kHz) yläpuolella. Oikeilla pianonäytteillä kokeiltuna se muutti hetkellistä sointutunnistusta alle 1 %:ssa kehyksistä, vaikka naksu oli moninkertaisesti soittoa kovempi. Analyysiketjussa on jyrkkä alipäästösuodin 2,2 kHz:ssä (n. 48 dB/oktaavi). Lisäksi jokaisen klikin kohdalla (kaiutin–mikrofoni-viive huomioiden) jätetään analyysistä pois lyhyt aikaikkuna (oletus 80 ms, säädettävä). Äänimerkin ja kehun ajaksi tunnistus pysäytetään, jotta oma äänimerkki ei sotke analyysiä.

## Tiedossa olevat rajoitukset

- **Demo on testattu vain yksikkötesteillä ja testitilassa.** Kynnysarvot (sointupohjien vähimmäisosuma, sävellajituki, yläsävelvähennys) on viritetty synteettisellä datalla. Ne kannattaa tarkistaa oikealla soittimella ja oikeassa tilassa.
- **Bassoalue:** 16 384 näytteen FFT:n erottelukyky on n. 3 Hz, joten aivan matalimpia säveliä (alle n. C2) ei erotella suoraan. 16'-jalkiön sävel tunnistetaan sen yläsävelistä (8' ja 4' oktaavit), mikä riittää sävelluokalle.
- **Viive:** FFT-ikkuna (n. 0,35 s) ja minimikesto (0,4 s) tekevät yhdessä sen, että kadenssi kuittautuu noin 0,5–1 s tonikan alkamisen jälkeen.
- **Sointuvalikoima:** vain duuri, molli, V7, vähennetty, maj7 ja m7. Esimerkiksi sus4-pidätys ennen V:tä voi tunnistua väärin tai jäädä tunnistumatta. Pidätyksen ratkettua V tunnistuu normaalisti. Pelkkä kvintti ilman terssiä jätetään tarkoituksella tunnistamatta.
- **Vähennetty septimisointu (vii°7)** ei kelpaa dominantiksi: kadenssiin vaaditaan V tai V7.
- **Pikardian terssi** (mollissa V–I duurina) ei kelpaa mollin kadenssiksi.
- **Nopea improvisointi:** jos sointu soi lyhyemmän ajan kuin minimikesto, se ei rekisteröidy.
- **Wake Lock** ja **mikrofoni** vaativat suojatun yhteyden: `localhost` käy, mutta puhelimessa sovellus pitää tarjota HTTPS:n kautta (esim. staattinen HTTPS-isännöinti tai `vite --host` yhdessä HTTPS-varmenteen kanssa). Pelkällä lähiverkon http-osoitteella mikrofoni ei toimi puhelimessa.
- **PWA:** manifest ja yksinkertainen service worker ovat valmiina. Service worker rekisteröidään vain tuotantoversiossa (`npm run build`). Kuvakkeet ovat SVG-muotoisia. Jos jokin vanhempi iOS-versio vaatii PNG-kuvakkeet, ne pitää lisätä erikseen.
- **Metronomi:** jos kaiutin on hyvin lähellä mikrofonia ja voimakkuus on suuri, klikki voi silti vuotaa analyysiin. Laske tällöin voimakkuutta tai kasvata maskausaikaa.
