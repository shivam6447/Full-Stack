import 'dotenv/config';
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import connectDB from './db/index.js';
import { app } from './app.js';

connectDB()
    .then(() => {
        app.get('/', (req, res) => {
            res.json({ message: 'Server is running' });
        });

        const port = process.env.PORT || 8000;
        app.listen(port, () => {
            console.log(`Server is running at port: ${port}`);
        });
    })
    .catch((error) => {
        console.log('Mongo DB connection failed !!', error);
    });
