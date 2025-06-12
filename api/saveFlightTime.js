import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST method is allowed.' });
  }

  try {
    const { ref, flightTime } = req.body;

    if (!ref || !flightTime) {
      return res.status(400).json({ message: 'Missing ref or flightTime' });
    }

    const filePath = path.resolve('./flighttimes.json');
    const data = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      : {};

    data[ref] = flightTime;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    res.status(200).json({ message: 'Flight time saved.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}
