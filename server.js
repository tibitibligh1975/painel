const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Criar pasta temp se não existir
if (!fs.existsSync(path.join(__dirname, 'temp'))) {
    fs.mkdirSync(path.join(__dirname, 'temp'));
}

// Criar pasta uploads se não existir
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

app.use(express.static('public'));

// Rota para o painel administrativo
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/painel.html'));
});

// Rota para preview do checkout (opcional)
app.get('/preview', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/index.html'));
});

app.post('/generate-checkout', upload.single('logo'), async (req, res) => {
    // Aumenta o timeout da resposta
    res.setTimeout(120000); // 2 minutos
    
    console.log('Recebida requisição de checkout');
    console.log('Dados recebidos:', req.body);
    
    try {
        // Verifica se os templates existem antes de tentar ler
        const templatesPath = path.join(__dirname, 'templates');
        if (!fs.existsSync(path.join(templatesPath, 'index.html'))) {
            throw new Error('Template index.html não encontrado');
        }
        if (!fs.existsSync(path.join(templatesPath, 'sucesso.html'))) {
            throw new Error('Template sucesso.html não encontrado');
        }

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
        let checkoutTemplate = fs.readFileSync(path.join(templatesPath, 'index.html'), 'utf8');
        let sucessoTemplate = fs.readFileSync(path.join(templatesPath, 'sucesso.html'), 'utf8');

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

        // Adiciona tratamento de erro para o arquivo ZIP
        const zipPath = path.join(__dirname, 'temp/checkout.zip');
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath); // Remove arquivo ZIP anterior se existir
        }

        const archive = archiver('zip', {
            zlib: { level: 9 } // Nível máximo de compressão
        });

        const output = fs.createWriteStream(zipPath);

        output.on('close', () => {
            console.log('Arquivo ZIP criado com sucesso');
            res.download(zipPath, 'checkout-files.zip', (err) => {
                if (err) {
                    console.error('Erro ao enviar arquivo:', err);
                    return res.status(500).send('Erro ao fazer download do arquivo');
                }
                // Limpa os arquivos temporários
                try {
                    fs.unlinkSync(zipPath);
                    if (req.file) {
                        fs.unlinkSync(req.file.path);
                    }
                } catch (cleanupError) {
                    console.error('Erro ao limpar arquivos temporários:', cleanupError);
                }
            });
        });

        archive.on('error', (err) => {
            console.error('Erro ao criar arquivo ZIP:', err);
            return res.status(500).send('Erro ao criar arquivo ZIP');
        });

        archive.on('warning', (err) => {
            console.warn('Aviso ao criar ZIP:', err);
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
                fs.createReadStream(path.join(templatesPath, 'images', image)), 
                { name: `images/${image}` }
            );
        }

        console.log('Finalizando arquivo ZIP...');
        await archive.finalize();
        
    } catch (error) {
        console.error('Erro ao gerar checkout:', error);
        return res.status(500).json({
            error: true,
            message: error.message,
            details: error.stack
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 