#!/usr/bin/env python3
"""Erzeugt dist/data/kfg-i18n.json — die Sprachdatei des Konfigurators.

Schluessel ist der exakte deutsche Text, wie er im Markup oder zur Laufzeit
entsteht. Der Konfigurator laedt die Datei nur, wenn die Seite nicht deutsch
ist, und ersetzt danach die Textknoten unter [data-kfg-root].

Warum Schluessel = deutscher Text und keine IDs: die Texte stecken an rund 130
Stellen in Vorlagen-Zeichenketten. IDs einzuziehen haette jeden Aufrufer
angefasst; so bleibt der Code unveraendert und die Uebersetzung ist an einer
Stelle nachlesbar — auch fuer Maks beim Gegenlesen des Polnischen.
"""
import json, os

DE_EBENSO = (', ebenso Eck-Ausklinkung und U-Ausschnitt: bitte über „Eigenes Bohrbild / Skizze" '
             'in Schritt 05 angeben. Fertigung aus Multiplex + Laminat + ABS-Kante.')
PL_EBENSO = (", podobnie wycięcie narożne i wycięcie w kształcie U: podaj je w kroku 05 w polu "
             "„Własny układ otworów / szkic”. Produkcja ze sklejki, laminatu i obrzeża ABS.")
EN_EBENSO = (", as are a corner notch and a U-shaped cut out: please state them in step 05 under "
             "“Your own hole pattern / sketch”. Made from plywood, laminate and an ABS edge.")

DE_SKIZZE = ('Beschreibe kurz, was du brauchst \u2014 z. B. \u201eEck-Ausklinkung '
             '20\u00d715 cm hinten links\u201c.')
PL_SKIZZE = ('Opisz krótko, czego potrzebujesz \u2014 np. \u201ewycięcie narożne '
             '20\u00d715 cm z tyłu po lewej\u201d.')
EN_SKIZZE = ('Briefly describe what you need \u2014 e.g. \u201ccorner notch '
             '20\u00d715 cm at the back left\u201d.')

# ── Format: deutsch: [polnisch, englisch] ───────────────────────────────────
T = {
# Vorschau und Preiskarte
"Ab Lager": ["Z magazynu", "From stock"],
"Kante & Material im Detail": ["Obrzeże i materiał w szczegółach", "Edge & material in detail"],
"Vorschaubild": ["Podgląd", "Preview image"],
"Draufsicht, maßstabsgetreu · Kanten und Ecken anklickbar":
  ["Widok z góry, w skali · krawędzie i narożniki klikalne",
   "Top view, to scale · edges and corners are clickable"],
"Draufsicht, maßstabsgetreu · Kanten anklickbar":
  ["Widok z góry, w skali · krawędzie klikalne", "Top view, to scale · edges are clickable"],
"Dein Preis": ["Twoja cena", "Your price"],
"Preis ab (zzgl. Sonderarbeiten)": ["Cena od (bez prac dodatkowych)", "Price from (excl. special work)"],
"inkl. MwSt., kostenloser Versand bis 120 cm":
  ["z VAT, darmowa wysyłka do 120 cm", "incl. VAT, free shipping up to 120 cm"],
"Preis-Aufschlüsselung": ["Rozbicie ceny", "Price breakdown"],
"Deine Konfiguration": ["Twoja konfiguracja", "Your configuration"],
"In den Warenkorb": ["Do koszyka", "Add to cart"],
"Unverbindlich anfragen": ["Zapytaj niezobowiązująco", "Request a quote"],
"Manufaktur seit 1897": ["Manufaktura od 1897", "Workshop since 1897"],
"CNC-präzise Kanten": ["Krawędzie cięte CNC", "CNC-precise edges"],
"Versand bis 120 cm gratis": ["Wysyłka do 120 cm gratis", "Free shipping up to 120 cm"],
"Konfiguration teilen": ["Udostępnij konfigurację", "Share configuration"],
"Per E-Mail senden": ["Wyślij e-mailem", "Send by email"],
"Versand bis ": ["Wysyłka do ", "Delivery by "],
"DHL, ab Lager": ["DHL, z magazynu", "DHL, from stock"],
"Angebot in 24 h": ["Oferta w 24 h", "Quote within 24 h"],
"Versandkosten im Angebot": ["Koszty wysyłki w ofercie", "Shipping costs in the quote"],
"Fertigung · Angebot in 24 h": ["Produkcja · oferta w 24 h", "Production · quote within 24 h"],
"im Angebot": ["w ofercie", "in the quote"],

# Zustandszeile
"Ab Lager · lieferbar in 3 bis 5 Tagen":
  ["Z magazynu · wysyłka w 3 do 5 dni", "In stock · ships in 3 to 5 days"],
"Individuelle Fertigung · Angebot in 24 h":
  ["Produkcja indywidualna · oferta w 24 h", "Custom production · quote within 24 h"],
"CNC-Fertigung · Preis steht fest":
  ["Produkcja CNC · cena ustalona", "CNC production · price is fixed"],
"CNC-Fertigung nach Maß": ["Produkcja CNC na wymiar", "CNC production made to measure"],

# Schritt 01
"Material & Dekor": ["Materiał i dekor", "Material & decor"],
"Oberfläche": ["Powierzchnia", "Surface"],
"Birke natur": ["Brzoza natura", "Natural birch"],
"geschliffen": ["szlifowana", "sanded"],
"HPL-Laminat": ["Laminat HPL", "HPL laminate"],
"alle Dekore": ["wszystkie dekory", "all decors"],
"Klarlack": ["Lakier bezbarwny", "Clear lacquer"],
"Angebot": ["Oferta", "Quote"],
"ABS-Kantenfarbe": ["Kolor obrzeża ABS", "ABS edge colour"],
"Unsicher beim Dekor?": ["Nie wiesz, jaki dekor?", "Unsure about the decor?"],
"Musterbox mit 4 Dekoren — 4,90 €, voll angerechnet beim Kauf":
  ["Zestaw 4 próbek — 4,90 €, w całości odliczane przy zakupie",
   "Sample box with 4 decors — €4.90, fully credited against your purchase"],
"Muster bestellen": ["Zamów próbki", "Order samples"],
"Original-Produktfotos aus dem Kessler-Archiv. Farbige ABS-Kanten sind für 18 und 25 mm verfügbar.":
  ["Oryginalne zdjęcia produktów z archiwum Kessler. Kolorowe obrzeża ABS są dostępne dla 18 i 25 mm.",
   "Original product photos from the Kessler archive. Coloured ABS edges are available for 18 and 25 mm."],
"Auf Multiplex lässt sich jedes Laminat unserer Möbelplatten-Palette aufkleben, die Kante bleibt sichtbare Birkenschicht.":
  ["Na sklejkę można nakleić każdy laminat z naszej palety płyt meblowych, krawędź pozostaje widoczną warstwą brzozy.",
   "Any laminate from our furniture board range can be bonded to plywood; the edge stays visible birch."],

# Schritt 02
"Form": ["Kształt", "Shape"],
"Rechteck": ["Prostokąt", "Rectangle"],
"Rund": ["Okrągły", "Round"],
"L-Form": ["Kształt L", "L-shape"],
"Nähmaschinen-Platte": ["Blat pod maszynę do szycia", "Sewing machine top"],
"Ecken abrunden": ["Zaokrąglij narożniki", "Round the corners"],
"Radius je Ecke": ["Promień dla każdego narożnika", "Radius per corner"],

# Schritt 03
"Maß": ["Wymiar", "Size"],
"Länge": ["Długość", "Length"],
"Breite": ["Szerokość", "Width"],
"Höhe": ["Wysokość", "Height"],
"Durchmesser Ø": ["Średnica Ø", "Diameter Ø"],
"Gesamtlänge": ["Długość całkowita", "Overall length"],
"Gesamtbreite": ["Szerokość całkowita", "Overall width"],
"Ausklinkung Breite": ["Szerokość wycięcia", "Notch width"],
"Ausklinkung Tiefe": ["Głębokość wycięcia", "Notch depth"],
"Innenecke wird automatisch verrundet: R50 bei Möbelplatte · R10 bei Multiplex & Compact (Fertigungsregel).":
  ["Narożnik wewnętrzny jest zaokrąglany automatycznie: R50 przy płycie meblowej · R10 przy sklejce i compact (reguła produkcji).",
   "The inner corner is rounded automatically: R50 on furniture board · R10 on plywood and compact (production rule)."],
"Plattenbreite": ["Szerokość płyty", "Board width"],
"Plattentiefe": ["Głębokość płyty", "Board depth"],
"Maschinen-Ausschnitt (Tiefe 18 cm)": ["Wycięcie pod maszynę (głębokość 18 cm)", "Machine cut out (18 cm deep)"],
"Standardmaße —": ["Wymiary standardowe —", "Standard sizes —"],
"jedes andere Maß ist möglich": ["każdy inny wymiar jest możliwy", "any other size is possible"],
"Ab Lager — sofort lieferbar:": ["Z magazynu — od ręki:", "From stock — available now:"],
"Richtig messen — so geht's": ["Jak mierzyć poprawnie", "How to measure correctly"],
"Miss die gewünschte Fläche an der breitesten Stelle und rechne bei Wandmontage 5 mm Luft ein. Bei Gestellen: Plattenüberstand 5–15 cm je Seite einplanen. Unsicher? Ruf uns an — wir prüfen dein Maß kostenlos vor der Fertigung.":
  ["Zmierz powierzchnię w najszerszym miejscu, a przy montażu do ściany doliczy 5 mm luzu. Przy stelażach zaplanuj 5 do 15 cm nawisu płyty na stronę. Nie masz pewności? Zadzwoń — sprawdzimy Twój wymiar bezpłatnie przed produkcją.",
   "Measure the area at its widest point and allow 5 mm of play for wall mounting. With frames, plan an overhang of 5 to 15 cm per side. Not sure? Call us — we check your measurements free of charge before production."],
"Größen": ["Rozmiary", "Sizes"],

# Schritt 04
"Stärke & Kante": ["Grubość i obrzeże", "Thickness & edge"],
"Kantenprofil": ["Profil obrzeża", "Edge profile"],
"Rundungsradius der Kante": ["Promień zaokrąglenia krawędzi", "Edge rounding radius"],
"ABS-Kante 2 mm · R2": ["Obrzeże ABS 2 mm · R2", "ABS edge 2 mm · R2"],
"serienmäßig": ["w standardzie", "as standard"],
"Multiplex: sichtbare Birkenschichtkante — leicht gefast ist serienmäßig. 45° gefräst oder halbrund gegen Aufpreis; Seiten auf Wunsch mit ABS oder klarlackiert (Angebot).":
  ["Sklejka: widoczna warstwowa krawędź brzozy — lekka faza w standardzie. Faza 45° lub półokrągła za dopłatą; boki na życzenie z ABS lub lakierowane bezbarwnie (oferta).",
   "Plywood: visible layered birch edge — a light chamfer comes as standard. A 45° chamfer or half round costs extra; sides with ABS or clear lacquer on request (quote)."],
"Tipp: Klicke in der 2D-Vorschau direkt auf eine Kante, um sie einzeln zu ändern.":
  ["Wskazówka: kliknij krawędź w podglądzie 2D, aby zmienić ją pojedynczo.",
   "Tip: click an edge directly in the 2D preview to change it on its own."],

# Schritt 05
"Ausschnitte & Bohrungen": ["Wycięcia i otwory", "Cut outs & holes"],
"Bohrungen & Durchlässe": ["Otwory i przepusty", "Holes & cable ports"],
"Montagebohrungen 4× Ø8": ["Otwory montażowe 4× Ø8", "Mounting holes 4× Ø8"],
"vorgebohrt für gängige Gestelle": ["nawiercone pod typowe stelaże", "pre-drilled for common frames"],
"Kabeldurchlass Ø60": ["Przepust kablowy Ø60", "Cable port Ø60"],
"Kabeldurchlass Ø80": ["Przepust kablowy Ø80", "Cable port Ø80"],
"inkl. Abdeckung, frei positionierbar": ["z zaślepką, dowolne położenie", "incl. cover, freely positioned"],
"Armaturenbohrung Ø35": ["Otwór pod armaturę Ø35", "Tap hole Ø35"],
"für Armatur oder Kabeldose": ["pod armaturę lub puszkę kablową", "for a tap or a cable outlet"],
"Küchen-Ausschnitte": ["Wycięcia kuchenne", "Kitchen cut outs"],
"Steckdosen-Ausschnitt": ["Wycięcie pod gniazdo", "Socket cut out"],
"26,5 × 10 cm, für USB oder Steckdose": ["26,5 × 10 cm, pod USB lub gniazdo", "26.5 × 10 cm, for USB or a socket"],
"Spülen-Ausschnitt": ["Wycięcie pod zlew", "Sink cut out"],
"78 × 43 cm, Küchen-Arbeitsplatte": ["78 × 43 cm, blat kuchenny", "78 × 43 cm, kitchen worktop"],
"Induktionsfeld-Ausschnitt": ["Wycięcie pod płytę indukcyjną", "Induction hob cut out"],
"56 × 49 cm, Küchen-Arbeitsplatte": ["56 × 49 cm, blat kuchenny", "56 × 49 cm, kitchen worktop"],
"Individuelle Bearbeitung": ["Obróbka indywidualna", "Individual machining"],
"Eigenes Bohrbild": ["Własny układ otworów", "Your own hole pattern"],
"frei nach deiner Vorgabe, CNC-gefräst": ["dowolnie według Twojego rysunku, frezowane CNC", "freely to your specification, CNC milled"],
"Skizze oder Zeichnung hochladen": ["Wgraj szkic lub rysunek", "Upload a sketch or drawing"],
"PDF, Foto, DXF — oder einfach später per E-Mail an uns schicken":
  ["PDF, zdjęcie, DXF — albo po prostu prześlij nam później e-mailem",
   "PDF, photo, DXF — or simply email it to us later"],
"Mit eigener Skizze wird deine Platte individuell gefertigt — verbindliches Angebot in 24 h.":
  ["Z własnym szkicem Twoja płyta powstaje indywidualnie — wiążąca oferta w 24 h.",
   "With your own sketch your board is made individually — binding quote within 24 h."],
"Frei gestalten": ["Zaprojektuj dowolnie", "Design freely"],
"In der Vorschau aufziehen oder hinzufügen — danach jede Position auf den Millimeter genau einstellbar. Der Preis wird sofort berechnet.":
  ["Rozciągnij w podglądzie albo dodaj — potem ustawisz każdą pozycję co do milimetra. Cena liczy się od razu.",
   "Drag it out in the preview or add it — then set every position to the millimetre. The price is calculated immediately."],
"Ausschnitt": ["Wycięcie", "Cut out"],
"Runder Ausschnitt": ["Wycięcie okrągłe", "Round cut out"],
"Freie Kontur": ["Dowolny kontur", "Free contour"],
"Kabelkanal fräsen": ["Frezuj kanał kablowy", "Mill a cable channel"],
"Kabelkanal": ["Kanał kablowy", "Cable channel"],
"Zeichnen-Modus: In der Vorschau aufziehen.": ["Tryb rysowania: rozciągnij w podglądzie.", "Drawing mode: drag it out in the preview."],

# Felder der freien Bearbeitung
"Kanalbreite": ["Szerokość kanału", "Channel width"],
"Frästiefe": ["Głębokość frezowania", "Milling depth"],
"Richtung": ["Kierunek", "Direction"],
"längs (links → rechts)": ["wzdłuż (od lewej do prawej)", "lengthwise (left to right)"],
"quer (hinten → vorne)": ["w poprzek (od tyłu do przodu)", "crosswise (back to front)"],
"Seite": ["Strona", "Side"],
"Oberseite": ["Wierzch", "Top side"],
"Unterseite": ["Spód", "Underside"],
"Enden": ["Zakończenia", "Ends"],
"Radius": ["Promień", "Radius"],
"X ab links": ["X od lewej", "X from the left"],
"Y ab hinten": ["Y od tyłu", "Y from the back"],
"Breite": ["Szerokość", "Width"],
"Anfang an der Kante": ["Początek przy krawędzi", "Start at the edge"],
"Ende an der Kante": ["Koniec przy krawędzi", "End at the edge"],
"beide an der Kante": ["oba przy krawędzi", "both at the edge"],
"geschlossen": ["zamknięte", "closed"],

# Meldungen
"Zu klein: mindestens 3 cm": ["Za mało: co najmniej 3 cm", "Too small: at least 3 cm"],
"Zu klein: mindestens 3 cm aufziehen": ["Za mało: rozciągnij na co najmniej 3 cm", "Too small: drag out at least 3 cm"],
"Zu kurz: mindestens 5 cm": ["Za krótko: co najmniej 5 cm", "Too short: at least 5 cm"],
"Ziehe den Ausschnitt in der Vorschau auf": ["Rozciągnij wycięcie w podglądzie", "Drag the cut out in the preview"],
"Weitere Punkte klicken · Doppelklick schließt die Kontur":
  ["Klikaj kolejne punkty · dwuklik zamyka kontur", "Click further points · double click closes the contour"],
"Doppelklick schließt": ["dwuklik zamyka", "double click closes"],
"weiter klicken": ["klikaj dalej", "keep clicking"],
"3D-Ansicht konnte nicht geladen werden": ["Nie udało się wczytać widoku 3D", "The 3D view could not be loaded"],
"Möbelplatte: Außenradius mind. R30, angepasst":
  ["Płyta meblowa: promień zewnętrzny min. R30, dopasowano", "Furniture board: outer radius min. R30, adjusted"],
"Möbelplatte (ABS-Kante): Außenradien mind. R30. Kleinere Radien sind fertigungstechnisch nicht möglich.":
  ["Płyta meblowa (obrzeże ABS): promienie zewnętrzne min. R30. Mniejsze promienie nie są możliwe technologicznie.",
   "Furniture board (ABS edge): outer radii min. R30. Smaller radii are not possible in production."],
"Ausklinkungen aktuell nur beim Rechteck": ["Wycięcia narożne obecnie tylko przy prostokącie", "Notches are currently only available on rectangles"],
"Kabelkanal aktuell nur bei eckigen Formen": ["Kanał kablowy obecnie tylko przy kształtach kanciastych", "Cable channels are currently only available on angular shapes"],
"Kabelkanal hinzugefügt — Länge, Breite und Lage stellst du unten ein":
  ["Dodano kanał kablowy — długość, szerokość i położenie ustawisz poniżej",
   "Cable channel added — set length, width and position below"],
"Innenradius mindestens R5 (Fräserdurchmesser)": ["Promień wewnętrzny co najmniej R5 (średnica frezu)", "Inner radius at least R5 (cutter diameter)"],
"Tiefer als 60 % der Platte — bitte vorher anfragen": ["Głębiej niż 60 % płyty — prosimy o wcześniejsze zapytanie", "Deeper than 60 % of the board — please ask first"],

# Modal
"So kommt deine Bestellung bei uns an": ["Tak trafia do nas Twoje zamówienie", "This is how your order reaches us"],
"Demo · interne Ansicht": ["Demo · widok wewnętrzny", "Demo · internal view"],
"Fertigungszeichnung — automatisch aus der Konfiguration erzeugt (inkl. Ausschnitt-Abstände)":
  ["Rysunek produkcyjny — generowany automatycznie z konfiguracji (z odstępami wycięć)",
   "Production drawing — generated automatically from the configuration (incl. cut out spacing)"],

# Dekornamen
"Weiß": ["Biały", "White"],
"Alaska Weiß": ["Alaska biały", "Alaska white"],
"Kiefer Weiß": ["Sosna bielona", "Bleached pine"],
"Kaschmir": ["Kaszmir", "Cashmere"],
"Grau": ["Szary", "Grey"],
"Asche Grau": ["Popielaty", "Ash grey"],
"Dunkelgrau": ["Ciemnoszary", "Dark grey"],
"Schwarz": ["Czarny", "Black"],
"Ahorn": ["Klon", "Maple"],
"Buche": ["Buk", "Beech"],
"Eiche Sonoma": ["Dąb sonoma", "Sonoma oak"],
"Eiche Artison": ["Dąb artison", "Artisan oak"],
"Eiche Hickory": ["Dąb hikora", "Hickory oak"],
"Weißer Marmor": ["Biały marmur", "White marble"],
"Schwarzer Marmor": ["Czarny marmur", "Black marble"],
"Grün": ["Zielony", "Green"],
"Rot": ["Czerwony", "Red"],
"Gelb": ["Żółty", "Yellow"],
"Blau": ["Niebieski", "Blue"],
"Dekorgleich": ["Zgodny z dekorem", "Matching the decor"],
"Standard": ["Standard", "Standard"],
"Möbelplatte": ["Płyta meblowa", "Furniture board"],
"Multiplex Birke": ["Sklejka brzozowa", "Birch plywood"],
"Compact / HPL": ["Compact / HPL", "Compact / HPL"],

# Kanten
"hinten": ["z tyłu", "back"],
"rechts": ["z prawej", "right"],
"vorne": ["z przodu", "front"],
"links": ["z lewej", "left"],
"Kante": ["Krawędź", "Edge"],
"Ecke": ["Narożnik", "Corner"],
"Leicht gefast": ["Lekko fazowana", "Lightly chamfered"],
"Gefast 45°": ["Faza 45°", "Chamfered 45°"],
"Halbrund": ["Półokrągła", "Half round"],
"Geschliffen": ["Szlifowana", "Sanded"],
"optional": ["opcjonalnie", "optional"],
# Nachtrag: Bausteine der zusammengesetzten Zeilen
"Lagerartikel": ["Artykuł magazynowy", "Stock item"],
"ABS-Kante 2 mm": ["Obrzeże ABS 2 mm", "ABS edge 2 mm"],
"ABS-Kante": ["Obrzeże ABS", "ABS edge"],
"Größen ab Lager": ["rozmiarów z magazynu", "sizes from stock"],
"18/25/36 mm": ["18/25/36 mm", "18/25/36 mm"],
"Eck-Ausklinkung": ["wycięcie narożne", "corner notch"],
"hinten links": ["z tyłu po lewej", "back left"],
"hinten rechts": ["z tyłu po prawej", "back right"],
"vorne rechts": ["z przodu po prawej", "front right"],
"vorne links": ["z przodu po lewej", "front left"],
# Nachtrag 29.07. — von /tmp/diff_lang.js gefunden
"Gesamt inkl. MwSt.": ["Razem z VAT", "Total incl. VAT"],
"Eckig": ["Ostry", "Square"],
"alle Ecken": ["wszystkie narożniki", "all corners"],
"alle vier": ["wszystkie cztery", "all four"],
"gemischt": ["mieszane", "mixed"],
"inklusive": ["w cenie", "included"],
"Kanten je Seite": ["Krawędzie osobno dla każdego boku", "Edges set per side"],
"Vorschau der konfigurierten Tischplatte": ["Podgląd skonfigurowanego blatu",
                                            "Preview of the configured table top"],
"Weniger": ["Mniej", "Fewer"],
"Mehr": ["Więcej", "More"],
"Schließen": ["Zamknij", "Close"],
DE_SKIZZE: [PL_SKIZZE, EN_SKIZZE],
DE_EBENSO: [PL_EBENSO, EN_EBENSO],
}

# ── Muster fuer Texte, die zur Laufzeit aus Zahlen gebaut werden ────────────
# Reihenfolge zaehlt: das erste passende Muster gewinnt.
P = [
  [r"^Rechteck (.+)$", "Prostokąt $1", "Rectangle $1"],
  [r"^Rund Ø (.+)$", "Okrągły Ø $1", "Round Ø $1"],
  [r"^L-Form (.+)$", "Kształt L $1", "L-shape $1"],
  [r"^Nähmaschinen-Platte (.+)$", "Blat do maszyny do szycia $1", "Sewing machine top $1"],
  [r"^Radius (.+)$", "Promień $1", "Radius $1"],
  [r"^Ecken (.+)$", "Narożniki $1", "Corners $1"],
  [r"^ABS (.+)$", "ABS $1", "ABS $1"],
  [r"^Kante ([A-D]): (.+)$", "Krawędź $1: $2", "Edge $1: $2"],
  [r"^Kante: (.+)$", "Krawędź: $1", "Edge: $1"],
  [r"^Kante ([A-D])$", "Krawędź $1", "Edge $1"],
  [r"^Ecke (.+), klicken zum Abrunden$", "Narożnik $1, kliknij, aby zaokrąglić", "Corner $1, click to round"],
  [r"^\+ (.+) / Stück$", "+ $1 / szt.", "+ $1 / piece"],
  [r"^ab (.+)$", "od $1", "from $1"],
  [r"^(\d+) bis (\d+) cm$", "$1 do $2 cm", "$1 to $2 cm"],
  [r"^(\d+) Größen ab Lager$", "$1 rozmiarów z magazynu", "$1 sizes from stock"],
  [r"^Lagerartikel (\d+)$", "Artykuł magazynowy $1", "Stock item $1"],
  [r"^Bitte (\d+) bis (\d+) cm eingeben$", "Podaj od $1 do $2 cm", "Please enter $1 to $2 cm"],
  [r"^(\d+) gewählt$", "wybrano: $1", "$1 selected"],
  [r"^Ausschnitt hinzugefügt · (.+)$", "Dodano wycięcie · $1", "Cut out added · $1"],
  [r"^Runder Ausschnitt hinzugefügt · (.+)$", "Dodano wycięcie okrągłe · $1", "Round cut out added · $1"],
  [r"^Freie Kontur hinzugefügt · (.+)$", "Dodano dowolny kontur · $1", "Free contour added · $1"],
  [r"^Kabelkanal hinzugefügt · (.+)$", "Dodano kanał kablowy · $1", "Cable channel added · $1"],
  [r"^Ecke (.+): R(\d+)$", "Narożnik $1: R$2", "Corner $1: R$2"],
  [r"^Ecke (.+) wieder eckig$", "Narożnik $1 znów ostry", "Corner $1 square again"],
  [r"^R(\d+) · alle Außenecken$", "R$1 · wszystkie narożniki zewnętrzne", "R$1 · all outer corners"],
  [r"^Versand bis (.+)$", "Wysyłka do $1", "Delivery by $1"],
  [r"^Kabelkanal (.+) cm$", "Kanał kablowy $1 cm", "Cable channel $1 cm"],
  [r"^Länge (.+) cm · (.+) je lfm$", "Długość $1 cm · $2 za mb", "Length $1 cm · $2 per linear metre"],
  [r"^(\d+) Punkte$", "$1 punktów", "$1 points"],
  [r"^Kantenfoto (.+), Originalaufnahme aus der Fertigung\.$",
   "Zdjęcie krawędzi $1, oryginalne ujęcie z produkcji.", "Edge photo $1, original shot from production."],
  [r"^Abbildung zeigt die Kante in 25 mm, unabhängig von der gewählten Stärke\. Gefertigt wird in (.+)\.$",
   "Ilustracja pokazuje krawędź w 25 mm, niezależnie od wybranej grubości. Produkujemy w $1.",
   "The image shows the edge at 25 mm, regardless of the thickness chosen. Yours is made in $1."],
]

data = {
  "_meta": {
    "name": "Kessler PRO — Konfigurator, Sprachdatei",
    "hinweis": "Schluessel ist der exakte deutsche Text. Der Konfigurator laedt die Datei "
               "nur bei nicht-deutschen Locales und ersetzt danach die Textknoten unter "
               "[data-kfg-root]. Polnisch bitte von Maks gegenlesen lassen.",
    "sprachen": ["pl", "en"],
    "anzahl": len(T),
    "muster": len(P),
  },
  "pl": {k: v[0] for k, v in T.items()},
  "en": {k: v[1] for k, v in T.items()},
  "muster": {
    "pl": [[p[0], p[1]] for p in P],
    "en": [[p[0], p[2]] for p in P],
  },
}

os.makedirs('/tmp/kps/dist/data', exist_ok=True)
with open('/tmp/kps/dist/data/kfg-i18n.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print('geschrieben:', len(T), 'Texte,', len(P), 'Muster')
