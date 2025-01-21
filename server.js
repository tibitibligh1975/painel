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

        // Lê os templates
        let checkoutTemplate = fs.readFileSync(path.join(__dirname, 'templates/index.html'), 'utf8');
        let sucessoTemplate = fs.readFileSync(path.join(__dirname, 'templates/sucesso.html'), 'utf8');

        // Substitui as variáveis em ambos os templates
        checkoutTemplate = checkoutTemplate
            .replace(/Checkout Padrao/g, name)
            .replace(/suporte@gmail\.com/g, email)
            .replace(/5511912345678/g, phone)
            .replace(/75544af2-e8a3-47b0-97a8-5ac21c61562d/g, offerId)
            .replace(/NOME DO PRODUTO/g, productName)
            .replace(/Descrição do produto/g, productDescription)
            .replace(/R\$ 97,00/g, `R$ ${price}`);

        sucessoTemplate = sucessoTemplate
            .replace(/Checkout Padrao/g, name)
            .replace(/NOME DO PRODUTO/g, productName);

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
        archive.append(sucessoTemplate, { name: 'sucesso.html' });
        
        if (req.file) {
            archive.file(req.file.path, { name: 'images/logo.webp' });
        }

        // Adiciona todos os SVGs necessários
        const imageFiles = [
            'tip-copy-paste.svg',
            'tip-smartphone-confirmation.svg',
            // Adicione aqui outros arquivos de imagem necessários
        ];

        for (const image of imageFiles) {
            archive.append(
                fs.createReadStream(path.join(__dirname, 'templates/images', image)), 
                { name: `images/${image}` }
            );
        }

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