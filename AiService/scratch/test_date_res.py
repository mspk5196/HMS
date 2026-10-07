import re
from datetime import datetime

date_list = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']

DAYS_OF_WEEK = {
    'monday': 0, 'mon': 0, 'tuesday': 1, 'tue': 1, 'tues': 1,
    'wednesday': 2, 'wed': 2, 'thursday': 3, 'thu': 3, 'thur': 3, 'thurs': 3,
    'friday': 4, 'fri': 4, 'saturday': 5, 'sat': 5, 'sunday': 6, 'sun': 6
}

def resolve_target_dates(clause: str, date_list: list):
    c = clause.lower().strip()
    matched = []
    
    # Check explicit all days
    if any(k in c for k in ['all days', 'every day', 'everyday', 'whole week', 'full week', 'entire week']):
        return list(date_list), True

    # 1. Check relative ranges (e.g. 'first 3 days', 'last 2 days')
    m_first = re.search(r'first\s*(\d+|one|two|three|four|five|six|seven)\s*days?', c)
    if m_first:
        w_map = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7}
        n = int(m_first.group(1)) if m_first.group(1).isdigit() else w_map.get(m_first.group(1), 3)
        return date_list[:min(n, len(date_list))], True

    m_last = re.search(r'last\s*(\d+|one|two|three|four|five|six|seven)\s*days?', c)
    if m_last:
        w_map = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7}
        n = int(m_last.group(1)) if m_last.group(1).isdigit() else w_map.get(m_last.group(1), 2)
        return date_list[-min(n, len(date_list)):], True

    # 2. Check exact ISO dates or sub-dates (e.g. '2026-10-07', '10-07', '10/07')
    for d_str in date_list:
        dt = datetime.strptime(d_str, '%Y-%m-%d')
        day_n = dt.day
        month_n = dt.month
        month_s = dt.strftime('%b').lower()
        month_l = dt.strftime('%B').lower()
        slash_date = d_str[5:].replace('-', '/')
        patterns = [
            rf'\b{re.escape(d_str)}\b',
            rf'\b{re.escape(d_str[5:])}\b',
            rf'\b{re.escape(slash_date)}\b',
            rf'\b0?{day_n}[/-]0?{month_n}\b',
            rf'\b{day_n}(?:st|nd|rd|th)?\s*(?:of\s*)?(?:{month_s}|{month_l})\b',
            rf'\b(?:{month_s}|{month_l})\s*{day_n}(?:st|nd|rd|th)?\b'
        ]
        for pat in patterns:
            if re.search(pat, c):
                if d_str not in matched:
                    matched.append(d_str)
                break

    # 3. Check days of week
    if 'weekend' in c:
        for d_str in date_list:
            dt = datetime.strptime(d_str, '%Y-%m-%d')
            if dt.weekday() in (5, 6) and d_str not in matched:
                matched.append(d_str)

    matched_dow = set()
    for dow_name, dow_idx in DAYS_OF_WEEK.items():
        if re.search(rf'\b{re.escape(dow_name)}\b', c):
            matched_dow.add(dow_idx)

    if matched_dow:
        for d_str in date_list:
            dt = datetime.strptime(d_str, '%Y-%m-%d')
            if dt.weekday() in matched_dow and d_str not in matched:
                matched.append(d_str)

    is_explicit = len(matched) > 0
    return matched, is_explicit

print('10-07 and 10-08:', resolve_target_dates('Assign DHARANI S to Night shift on 10-07 and 10-08', date_list))
print('Oct 9:', resolve_target_dates('Mahalakshmi on Oct 9 to Night shift', date_list))
print('Sunday off:', resolve_target_dates('Sunday off for Deepa', date_list))
print('No date given:', resolve_target_dates('Assign Aiswarya to Day Shift', date_list))
