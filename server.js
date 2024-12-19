const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// PostgreSQL Pool einrichten
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'aktivitaet_tracker',
    password: 'suziewong',
    port: 5432,
});

app.use(bodyParser.json());
app.use(express.static('public'));

// API-Endpunkt zum Hinzufügen einer Aktivität
app.post('/aktivitaet', async (req, res) => {
    const { beschreibung, startzeit, endzeit } = req.body;

    // Überprüfen auf zeitliche Überschneidungen
    const overlapCheck = await pool.query(
        'SELECT * FROM aktivitaeten WHERE (startzeit, endzeit) OVERLAPS ($1::timestamp, $2::timestamp)',
        [startzeit, endzeit]
    );

    if (overlapCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Die Aktivität überschneidet sich mit einer bestehenden Aktivität.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO aktivitaeten (beschreibung, startzeit, endzeit) VALUES ($1, $2, $3) RETURNING *',
            [beschreibung, startzeit, endzeit]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Fehler beim Hinzufügen der Aktivität:', error);
        res.status(500).json({ error: 'Fehler beim Hinzufügen der Aktivität' });
    }
});

// API-Endpunkt zum Abrufen aller Aktivitäten im angegebenen Zeitraum
app.get('/aktivitaeten', async (req, res) => {
    const { start, end } = req.query;

    let query = 'SELECT *, EXTRACT(EPOCH FROM (endzeit - startzeit)) AS dauer FROM aktivitaeten';
    const params = [];

    if (start && end) {
        query += ' WHERE startzeit >= $1 AND endzeit <= $2';
        params.push(start, end);
    }

    query += ' ORDER BY datum DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
});

// API-Endpunkt zum Löschen einer Aktivität
app.delete('/aktivitaet/:id', async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM aktivitaeten WHERE id = $1 RETURNING *', [id]);
    
    if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Aktivität nicht gefunden' });
    }
    
    res.json({ message: 'Aktivität gelöscht', deleted: result.rows[0] });
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
