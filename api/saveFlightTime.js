import { writeFileSync } from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;

    const filePath = path.join(process.cwd(), 'flighttimes.json');
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      res.status(200).json({ message: 'Flight time saved successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to save flight time', error });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
