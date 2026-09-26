import sqlite3

destinations = [
  { "id": "shikari-devi", "name": "Shikari Devi Temple", "state": "Himachal Pradesh", "region": "North", "category": "Temple and forest", "description": "A roofless high-altitude temple reached through thick forest, overlooking green pastures and snow ranges.", "latitude": 31.552919, "longitude": 77.165764 },
  { "id": "barot", "name": "Barot", "state": "Himachal Pradesh", "region": "North", "category": "Wildlife gateway", "description": "A quiet Uhl River settlement with trout, a British-built reservoir, and access to Nargu Wildlife Sanctuary.", "latitude": 32.01722, "longitude": 76.76554 },
  { "id": "patal-bhuvaneshwar", "name": "Patal Bhuvaneshwar", "state": "Uttarakhand", "region": "North", "category": "Cave temple", "description": "A subterranean Shiva shrine entered through a tunnel and narrow dark water passage near Gangolihat.", "latitude": 29.8, "longitude": 80.2 },
  { "id": "mubarak-mandi", "name": "Mubarak Mandi Palace", "state": "Jammu and Kashmir", "region": "North", "category": "Historic palace", "description": "A former Dogra royal residence combining Rajasthani and Mughal architecture with a museum in its Pink Hall.", "latitude": 32.739968, "longitude": 74.875705 },
  { "id": "basgo", "name": "Basgo Monastery and Fort", "state": "Ladakh", "region": "North", "category": "Monastery and ruins", "description": "A hilltop Buddhist complex known for Maitreya temples, murals, and dramatic Ladakh views.", "latitude": 34.224502, "longitude": 77.276717 },
  { "id": "bhangarh", "name": "Bhangarh Fort", "state": "Rajasthan", "region": "West", "category": "Haunted monument", "description": "A 17th-century ruined fort-town in the Aravalli hills, with temples, havelis, deserted markets, and local legend.", "latitude": 27.0958, "longitude": 76.2875 },
  { "id": "wild-ass", "name": "Wild Ass Sanctuary", "state": "Gujarat", "region": "West", "category": "Wildlife sanctuary", "description": "A vast salt-desert reserve protecting the last Indian wild ass and attracting flamingos and migratory cranes.", "latitude": 23.7087, "longitude": 71.018 },
  { "id": "lonar", "name": "Lonar Crater", "state": "Maharashtra", "region": "West", "category": "Geological wonder", "description": "A meteorite-impact crater lake surrounded by forest, wildlife, and centuries-old temples.", "latitude": 19.975, "longitude": 76.5075 },
  { "id": "bhimashankar", "name": "Bhimashankar Wildlife Sanctuary", "state": "Maharashtra", "region": "West", "category": "Forest sanctuary", "description": "Dense Sahyadri forest with Malabar giant squirrels, rich birdlife, trekking trails, and a Shiva temple.", "latitude": 19.2412, "longitude": 73.5858 },
  { "id": "netravali", "name": "Netravali Wildlife Sanctuary", "state": "Goa", "region": "West", "category": "Wildlife sanctuary", "description": "Moist deciduous and semi-evergreen forests with leopards, giant squirrels, mouse deer, and rare birds.", "latitude": 15.2208, "longitude": 74.3002 },
  { "id": "gudavi", "name": "Gudavi Bird Sanctuary", "state": "Karnataka", "region": "South", "category": "Bird sanctuary", "description": "A compact wetland sanctuary on Gudavi Lake known for seasonal resident and migratory waterbirds.", "latitude": 14.4417, "longitude": 75.025 },
  { "id": "gavi", "name": "Gavi Eco-Tourism", "state": "Kerala", "region": "South", "category": "Forest eco-tourism", "description": "Forest trekking, wildlife watching, camping, and night safaris within the Periyar landscape.", "latitude": 9.4405, "longitude": 77.1603 },
  { "id": "sittanavasal", "name": "Sittanavasal", "state": "Tamil Nadu", "region": "South", "category": "Rock-cut cave monument", "description": "An ASI-protected Jain and Tamil-Brahmi heritage site with a rock-cut cave temple and rare murals.", "latitude": 10.466, "longitude": 78.734 },
  { "id": "gandikota", "name": "Gandikota", "state": "Andhra Pradesh", "region": "South", "category": "Fort and gorge", "description": "A hilltop fort overlooking the dramatic Penna River gorge, with gateways, temples, and a mosque.", "latitude": 14.8147, "longitude": 78.2867 },
  { "id": "bogatha", "name": "Bogatha Waterfall", "state": "Telangana", "region": "South", "category": "Waterfall and trekking", "description": "A remote cascade reached by a short trek, celebrated for its powerful falls and rich surrounding landscape.", "latitude": 18.4761, "longitude": 80.5 },
  { "id": "debrigarh", "name": "Debrigarh Wildlife Sanctuary", "state": "Odisha", "region": "East", "category": "Wildlife sanctuary", "description": "Dry deciduous forest beside Hirakud Reservoir, with waterfalls, rich wildlife, and birding.", "latitude": 21.55, "longitude": 83.75 },
  { "id": "duarsini", "name": "Duarsini", "state": "West Bengal", "region": "East", "category": "Forest and tribal village", "description": "A quiet Purulia village surrounded by Sal forest, rolling hills, wildlife, and eco-tourism trails.", "latitude": 22.72, "longitude": 86.68 },
  { "id": "bhimbandh", "name": "Bhimbandh Wildlife Sanctuary", "state": "Bihar", "region": "East", "category": "Wildlife and hot springs", "description": "A rugged forest sanctuary with waterfalls, trekking, camping, and perennial hot springs.", "latitude": 25.18, "longitude": 86.35 },
  { "id": "kaimur", "name": "Kaimur Hills", "state": "Bihar", "region": "East", "category": "Rock art and wildlife", "description": "A sparsely visited landscape of deep jungle, gorges, waterfalls, caves, and prehistoric rock shelters.", "latitude": 24.95, "longitude": 84.05 },
  { "id": "suga-bandh", "name": "Suga Bandh Waterfall", "state": "Jharkhand", "region": "East", "category": "Waterfall", "description": "A little-known waterfall on the Betla-Netarhat route and a local favourite for a scenic detour.", "latitude": 23.72, "longitude": 84.08 },
  { "id": "mawphlang", "name": "Mawphlang Sacred Groves", "state": "Meghalaya", "region": "Northeast", "category": "Sacred forest", "description": "An ancient Khasi-protected grove where visitors may not remove even a twig or pebble.", "latitude": 25.5, "longitude": 91.75 },
  { "id": "siju", "name": "Siju Cave", "state": "Meghalaya", "region": "Northeast", "category": "Cave and unusual nature", "description": "A limestone cave near the Simsang River known for stalactites, underground streams, and thousands of bats.", "latitude": 25.32, "longitude": 90.68 },
  { "id": "fakim", "name": "Fakim Wildlife Sanctuary", "state": "Nagaland", "region": "Northeast", "category": "Wildlife sanctuary", "description": "A borderland sanctuary of steep ridges, deep gorges, orchids, hoolock gibbons, and Himalayan bears.", "latitude": 25.56, "longitude": 94.86 },
  { "id": "shirui", "name": "Shirui Hill", "state": "Manipur", "region": "Northeast", "category": "Mountain and endemic flora", "description": "A 2,835-metre hill sheltering the endemic Shirui Lily, which blooms around May and June.", "latitude": 25.106157, "longitude": 94.456682 },
  { "id": "khecheopalri", "name": "Khecheopalri Lake", "state": "Sikkim", "region": "Northeast", "category": "Sacred lake", "description": "A forest-framed lake near Pelling for nature photography, trekking, and spiritual quiet.", "latitude": 27.33, "longitude": 88.19 },
  { "id": "raneh", "name": "Raneh Falls", "state": "Madhya Pradesh", "region": "Central", "category": "Waterfall and wildlife", "description": "A multicoloured canyon carved by the Ken River, with waterfalls and wildlife in the Ken Gharial Sanctuary.", "latitude": 24.576, "longitude": 79.932 },
  { "id": "pandav", "name": "Pandav Falls", "state": "Madhya Pradesh", "region": "Central", "category": "Forest waterfall", "description": "A perennial cascade into a heart-shaped pool in Panna National Park, surrounded by forest and caves.", "latitude": 24.718, "longitude": 80.006 },
  { "id": "barnawapara", "name": "Barnawapara Wildlife Sanctuary", "state": "Chhattisgarh", "region": "Central", "category": "Wildlife sanctuary", "description": "A hilly, well-forested sanctuary known for gaur, chital, sambar, wild boar, and more than 150 bird species.", "latitude": 21.35, "longitude": 82.273 },
  { "id": "tala", "name": "Tala Devrani-Jethani Temples", "state": "Chhattisgarh", "region": "Central", "category": "Archaeological temples", "description": "A little-visited site at the Shivnath-Maniari confluence, famed for stone sculptures and ancient temples.", "latitude": 22.129, "longitude": 81.976 },
  { "id": "dipadih", "name": "Dipadih Temple Complex", "state": "Chhattisgarh", "region": "Central", "category": "Archaeological temple complex", "description": "A little-known 7th-century complex with stone pillars and mythological figures, hidden in northern Chhattisgarh.", "latitude": 23.107, "longitude": 83.918 }
]

conn = sqlite3.connect('wanderer.db')
cursor = conn.cursor()
cursor.execute('DELETE FROM places')
for p in destinations:
    # Assign a mood based on tags
    mood = "Heritage"
    cat = p['category'].lower()
    if 'wildlife' in cat or 'forest' in cat or 'bird' in cat:
        mood = "Wildlife"
    elif 'cave' in cat or 'waterfall' in cat or 'lake' in cat or 'geological' in cat:
        mood = "Coastal" # Reusing coastal for nature/water/geological since we had 4 moods
    elif 'quiet' in p['description'].lower() or 'village' in cat:
        mood = "Solitude"

    cursor.execute('''
        INSERT INTO places (name, description, state, category, latitude, longitude, image_url, mood)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (p['name'], p['description'], p['state'], p['category'], p['latitude'], p['longitude'], f"https://source.unsplash.com/800x600/?{p['category'].replace(' ', ',')},india", mood))
conn.commit()
conn.close()
print("Successfully seeded with corrected schema!")
