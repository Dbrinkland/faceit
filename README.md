# Faceit War Room

Cinematic FACEIT dashboard til jeres squad med:

- live fetch via server-side FACEIT key
- localStorage-cache som bevarer sidste gyldige snapshot
- manuel refresh-knap
- rød/sort UI med animationer, grafer og en procedural 3D-scene
- CS2 map-performance og sidste kamp pr. spiller
- klar til lokal udvikling og gratis deploy

## Lokal udvikling

1. Opret `.env.local` ud fra `.env.example`
2. Sæt mindst `server_side_key`
3. Kør:

```bash
npm install
npm run dev
```

Appen starter på `http://localhost:3000`.

Vil du dele teaseren alene, kan du åbne `http://localhost:3000/?teaser=1`.

## Environment variables

```bash
server_side_key=
client_side_key=
FACEIT_NICKNAMES=v1rtux,C10_dk,OllieReed,SunnyTheB,Wond3r_
```

`server_side_key` bruges til FACEIT-kald i API-route.

`client_side_key` er med som fallback-navn, men eksponeres ikke i browseren i denne version. Hvis du vil holde setup simpelt og sikkert, er det nok at sætte `server_side_key`.

## Data der hentes

Dashboardet bygger snapshot ud fra:

- player lookup via nickname
- recent match stats for CS2/CSGO
- recent match history

Det bruges til scorecards, squad-tabeller, kill-trends, multi-kill bars og player cards.

Tryk refresh efter hver kamp for at hente ny sidste-kamp data og opdatere performance pr. map.

## Teaser mode

Der er en intro-teaser på cirka 6 sekunder med skip-knap og replay-knap i dashboardet.

Hvis teaseren allerede er set, kan du tvinge den frem igen via `?teaser=1`, hvilket også er den letteste måde at dele teaser-linket på før launch.

## Deploy

Den nemmeste gratis vej er Vercel:

1. Push repoet til GitHub
2. Importér repoet i Vercel
3. Sæt `server_side_key`, `client_side_key` og eventuelt `FACEIT_NICKNAMES` som project environment variables
4. Deploy

Du behøver ikke GitHub Secrets for første iteration. Vercel project env vars er den enkleste løsning her.
