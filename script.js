const fileUpload = document.getElementById('file-upload');
const frameImagenes = document.getElementById('frame-imagenes');
const orderSelect = document.getElementById('order-select');
const noImagesMsg = document.getElementById('no-images-msg');
const generatePdfBtn = document.getElementById('generate-pdf-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const loaderOverlay = document.getElementById('loader-overlay');

let loadedFiles = [];
let selectedElement = null;

generatePdfBtn.onclick = generatePdfDownload;
clearAllBtn.onclick = clearAll;

fileUpload.addEventListener('change', (event) => {
    const files = Array.from(event.target.files);
    
    const newFiles = files.filter(newFile => 
        !loadedFiles.some(existingFile => 
            existingFile.name === newFile.name && existingFile.size === newFile.size
        )
    );

    newFiles.forEach(file => {
        loadedFiles.push({
            file: file,
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size, 
            lastModified: file.lastModified
        });
    });

    orderSelect.value = 'manual';
    updateImageDisplay();
});

orderSelect.addEventListener('change', () => {
    const criteria = orderSelect.value;

    if (criteria === 'name') {
        loadedFiles.sort((a, b) => a.name.localeCompare(b.name));
    } else if (criteria === 'date') {
        loadedFiles.sort((a, b) => b.lastModified - a.lastModified);
    }
    
    updateImageDisplay();
});

function clearAll() {
    loadedFiles.forEach(fileData => URL.revokeObjectURL(fileData.url));
    
    loadedFiles = [];
    selectedElement = null;
    
    fileUpload.value = ''; 
    
    updateImageDisplay();
}

function removeImage(indexToRemove) {
    if (indexToRemove >= 0 && indexToRemove < loadedFiles.length) {
        URL.revokeObjectURL(loadedFiles[indexToRemove].url);
        loadedFiles.splice(indexToRemove, 1);
        updateImageDisplay();
        selectedElement = null;
    }
}

function updateImageDisplay() {
    frameImagenes.innerHTML = '';
    
    if (loadedFiles.length === 0) {
        frameImagenes.appendChild(noImagesMsg);
        generatePdfBtn.disabled = true;
        return;
    }
    
    generatePdfBtn.disabled = false;
    
    loadedFiles.forEach((fileData, index) => {
        const frame = document.createElement('div');
        frame.className = 'image-frame';
        frame.draggable = true;
        frame.dataset.index = index;
        frame.dataset.filename = fileData.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = 'x';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeImage(index);
        };
        frame.appendChild(removeBtn);

        frame.innerHTML += `
            <img src="${fileData.url}" alt="${fileData.name}" class="pdf-image">
            <span class="order-label">Orden: ${index + 1}</span>
            <span class="filename-label">${fileData.name}</span>
        `;

        frame.addEventListener('click', (e) => {
            if (orderSelect.value !== 'manual') return; 
            
            const clickedIndex = parseInt(frame.dataset.index);
            handleSelectionSwap(frame, clickedIndex);
        });

        frame.addEventListener('dragstart', handleDragStart);
        frame.addEventListener('dragover', handleDragOver);
        frame.addEventListener('dragleave', handleDragLeave);
        frame.addEventListener('drop', handleDrop);
        frame.addEventListener('dragend', handleDragEnd);

        frameImagenes.appendChild(frame);
    });
}

function handleDragStart(e) {
    if (orderSelect.value !== 'manual') return e.preventDefault();
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
}

function handleDragOver(e) {
    e.preventDefault(); 
    this.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (orderSelect.value !== 'manual') return;

    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const targetIndex = parseInt(this.dataset.index);

    if (draggedIndex !== targetIndex) {
        const [movedFile] = loadedFiles.splice(draggedIndex, 1);
        loadedFiles.splice(targetIndex, 0, movedFile);

        updateImageDisplay();
    }
}

function handleDragEnd() {
    this.classList.remove('dragging');
}

function handleSelectionSwap(frame, clickedIndex) {
    if (selectedElement === null) {
        selectedElement = { frame, index: clickedIndex };
        frame.classList.add('selected');
    } else if (selectedElement.index === clickedIndex) {
        selectedElement.frame.classList.remove('selected');
        selectedElement = null;
    } else {
        const targetIndex = clickedIndex;
        const sourceIndex = selectedElement.index;

        const [movedFile] = loadedFiles.splice(sourceIndex, 1);
        loadedFiles.splice(targetIndex, 0, movedFile);

        selectedElement.frame.classList.remove('selected');
        selectedElement = null;
        updateImageDisplay();
    }
}

async function generatePdfDownload() {
    if (loadedFiles.length === 0) return;

    loaderOverlay.style.display = 'block';
    generatePdfBtn.disabled = true;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4'); 
    const docWidth = 210;
    const docHeight = 297;
    const MARGIN_MM = 15;
    const PAGINATION_Y_MM = docHeight - 10;

    const HEADER_HEIGHT_PX = 40;
    const HEADER_HEIGHT_MM = HEADER_HEIGHT_PX * 25.4 / 96;
    const HEADER_LINE_SPACE_MM = 1;
    const CONTENT_START_SPACE_MM = 4;
    const HEADER_Y_START = 10;
    
    const IMAGENES_POR_PAGINA = 6;
    const imgWidth = 80;
    const imgHeight = 75; 
    const hGap = 10;
    const vGap = 5; 
    
    try {
        const logoIzquierdo = new Image();
        logoIzquierdo.src = 'logo_izquierdo.png';
        await new Promise(resolve => logoIzquierdo.onload = resolve);
        const logoDerecho = new Image();
        logoDerecho.src = 'logo_derecho.png';
        await new Promise(resolve => logoDerecho.onload = resolve);

        const totalPages = Math.ceil(loadedFiles.length / IMAGENES_POR_PAGINA);

        const addHeaderAndFooter = (pageNumber) => {
            let headerY = HEADER_Y_START;
            
            const centerY = headerY + HEADER_HEIGHT_MM / 2;
            
            if (logoIzquierdo.src) {
                const aspectRatio = logoIzquierdo.width / logoIzquierdo.height;
                const logoHeight = HEADER_HEIGHT_MM;
                const logoWidth = logoHeight * aspectRatio;
                const xLogoIzq = MARGIN_MM;
                pdf.addImage(logoIzquierdo, 'PNG', xLogoIzq, headerY, logoWidth, logoHeight);
            }

            pdf.setFontSize(16);
            const textY = centerY + (pdf.internal.getFontSize() * 0.35 / pdf.internal.scaleFactor);
            pdf.text('REGISTRO FOTOGRÁFICO', docWidth / 2, textY, { align: 'center' });
            
            if (logoDerecho.src) {
                const aspectRatio = logoDerecho.width / logoDerecho.height;
                const logoHeight = HEADER_HEIGHT_MM;
                const logoWidth = logoHeight * aspectRatio;
                const xLogoDer = docWidth - MARGIN_MM - logoWidth;
                pdf.addImage(logoDerecho, 'PNG', xLogoDer, headerY, logoWidth, logoHeight);
            }
            
            const lineY = headerY + HEADER_HEIGHT_MM + HEADER_LINE_SPACE_MM;
            pdf.line(MARGIN_MM, lineY, docWidth - MARGIN_MM, lineY);
            
            pdf.setFontSize(8);
            pdf.text(`Página ${pageNumber} de ${totalPages}`, docWidth / 2, PAGINATION_Y_MM, { align: 'center' });
            
            return lineY + CONTENT_START_SPACE_MM;
        };
        
        let yOffset = addHeaderAndFooter(1);

        const startX = (docWidth - (imgWidth * 2 + hGap)) / 2;
        let currentX = startX;

        for (let i = 0; i < loadedFiles.length; i++) {
            const fileData = loadedFiles[i];
            const currentPage = Math.floor(i / IMAGENES_POR_PAGINA) + 1;
            
            if (yOffset + imgHeight + vGap > PAGINATION_Y_MM - 10) { 
                pdf.addPage();
                yOffset = addHeaderAndFooter(currentPage);
                currentX = startX;
            }
            
            const img = new Image();
            img.src = fileData.url;
            await new Promise(resolve => img.onload = resolve);

            const dataUrl = fileData.url;
            
            pdf.addImage(dataUrl, 'JPEG', currentX, yOffset, imgWidth, imgHeight, null, 'FAST');
            
            if (currentX === startX) {
                currentX += imgWidth + hGap;
            } else {
                currentX = startX;
                yOffset += imgHeight + vGap; 
            }
        }

        pdf.save('Registro_Fotografico.pdf');
        
        clearAll(); 

    } catch (error) {
        console.error("Error al generar el PDF:", error);
        alert("Ocurrió un error al generar el PDF. Asegúrate de que los archivos 'logo_izquierdo.png' y 'logo_derecho.png' estén en la misma carpeta y de que estás utilizando un servidor web local (http://) para evitar errores de CORS.");
    } finally {
        loaderOverlay.style.display = 'none';
        generatePdfBtn.disabled = false;
    }
}
