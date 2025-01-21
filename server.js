const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

// Add this new route to serve your main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/index.html'));
});

app.post('/generate-checkout', upload.single('logo'), async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            offerId,
            productName,
            productDescription,
            price
        } = req.body;

        // Lê o template do checkout
        let checkoutTemplate = fs.readFileSync(path.join(__dirname, 'templates/index.html'), 'utf8');

        // Substitui as variáveis no template
        checkoutTemplate = checkoutTemplate
            .replace(/Checkout Padrao/g, name)
            .replace(/suporte@gmail\.com/g, email)
            .replace(/5511912345678/g, phone)
            .replace(/75544af2-e8a3-47b0-97a8-5ac21c61562d/g, offerId)
            .replace(/NOME DO PRODUTO/g, productName)
            .replace(/Descrição do produto/g, productDescription)
            .replace(/R\$ 97,00/g, `R$ ${price}`);

        // Cria um arquivo ZIP
        const archive = archiver('zip');
        const output = fs.createWriteStream(path.join(__dirname, 'temp/checkout.zip'));

        output.on('close', () => {
            res.download(path.join(__dirname, 'temp/checkout.zip'), 'checkout-files.zip', (err) => {
                if (err) {
                    console.error('Erro ao enviar arquivo:', err);
                }
                // Limpa os arquivos temporários
                fs.unlinkSync(path.join(__dirname, 'temp/checkout.zip'));
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }
            });
        });

        archive.pipe(output);

        // Adiciona os arquivos ao ZIP
        archive.append(checkoutTemplate, { name: 'index.html' });
        
        if (req.file) {
            archive.file(req.file.path, { name: 'images/logo.webp' });
        }

        // Adiciona os SVGs
        archive.append(fs.createReadStream(path.join(__dirname, 'templates/images/tip-copy-paste.svg')), 
            { name: 'images/tip-copy-paste.svg' });
        archive.append(fs.createReadStream(path.join(__dirname, 'templates/images/tip-smartphone-confirmation.svg')), 
            { name: 'images/tip-smartphone-confirmation.svg' });

        archive.finalize();

    } catch (error) {
        console.error('Erro:', error);
        res.status(500).send('Erro ao gerar os arquivos');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 