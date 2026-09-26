import json
from pathlib import Path

CATALOG = json.loads((Path(__file__).parents[1] / 'data/destinations.json').read_text())
BY_ID = {p['id']: p for p in CATALOG}
XP = {'visit': 100, 'hidden_gem': 150, 'new_state': 250, 'milestones': {5: 200, 10: 500, 25: 1000}}
TIERS = [(7500, 'Elite Wanderer'), (3000, 'Tier I Wanderer'), (1000, 'Tier II Wanderer'), (0, 'Tier III Wanderer')]

def progression(entries):
    visited = [e for e in entries if e.status == 'Visited']
    states = {BY_ID[e.place_id]['state'] for e in visited}
    xp = sum(XP['hidden_gem'] if BY_ID[e.place_id]['is_hidden_gem'] else XP['visit'] for e in visited)
    xp += len(states) * XP['new_state'] + sum(b for n, b in XP['milestones'].items() if len(visited) >= n)
    floor, tier = next((n, t) for n, t in TIERS if xp >= n)
    next_xp = next((n for n, _ in reversed(TIERS) if n > xp), None)
    achievements = [{'name': name, 'count': count, 'target': target, 'unlocked': count >= target} for name, count, target in [
        ('First Journey', len(visited), 1), ('Hidden Gem Hunter', sum(BY_ID[e.place_id]['is_hidden_gem'] for e in visited), 5),
        ('Mountain Explorer', sum(BY_ID[e.place_id]['group'] == 'Mountains' for e in visited), 5),
        ('State Hopper', len(states), 5), ('India Explorer', len(states), 10), ('Elite Wanderer', xp, 7500)]]
    return {'xp': xp, 'tier': tier, 'floor': floor, 'next_xp': next_xp, 'states': len(states), 'visited': len(visited), 'achievements': achievements}
