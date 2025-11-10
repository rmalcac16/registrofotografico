const fileUpload = document.getElementById("file-upload");
const frameImagenes = document.getElementById("frame-imagenes");
const orderSelect = document.getElementById("order-select");
const noImagesMsg = document.getElementById("no-images-msg");
const generatePdfBtn = document.getElementById("generate-pdf-btn");
const clearAllBtn = document.getElementById("clear-all-btn");
const loaderOverlay = document.getElementById("loader-overlay");
const pdfFilenameInput = document.getElementById("pdf-filename-input");
const pdfTitleInput = document.getElementById("pdf-title-input");

let loadedFiles = [];
let selectedElement = null;

generatePdfBtn.onclick = generatePdfDownload;
clearAllBtn.onclick = clearAll;

fileUpload.addEventListener("change", (event) => {
  const files = Array.from(event.target.files);

  const newFiles = files.filter(
    (newFile) =>
      !loadedFiles.some(
        (existingFile) =>
          existingFile.name === newFile.name &&
          existingFile.size === newFile.size
      )
  );

  newFiles.forEach((file) => {
    loadedFiles.push({
      file: file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
    });
  });

  orderSelect.value = "manual";
  updateImageDisplay();
});

orderSelect.addEventListener("change", () => {
  const criteria = orderSelect.value;

  if (criteria === "name") {
    loadedFiles.sort((a, b) => a.name.localeCompare(b.name));
  } else if (criteria === "date") {
    loadedFiles.sort((a, b) => b.lastModified - a.lastModified);
  }

  updateImageDisplay();
});

function clearAll() {
  loadedFiles.forEach((fileData) => URL.revokeObjectURL(fileData.url));

  loadedFiles = [];
  selectedElement = null;

  fileUpload.value = "";
  pdfFilenameInput.value = "";
  pdfTitleInput.value = "REPORTE FOTOGRÁFICO";

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
  frameImagenes.innerHTML = "";
  // Oculta el mensaje de "No hay imágenes cargadas" si hay imágenes
  if (loadedFiles.length === 0) {
    noImagesMsg.style.display = "block";
    frameImagenes.appendChild(noImagesMsg);
    generatePdfBtn.disabled = true;
    return;
  } else {
    noImagesMsg.style.display = "none";
  }

  generatePdfBtn.disabled = false;

  loadedFiles.forEach((fileData, index) => {
    const frame = document.createElement("div");
    frame.className = "image-frame";
    frame.draggable = true;
    frame.dataset.index = index;
    frame.dataset.filename = fileData.name;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = "x";
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

    frame.addEventListener("click", (e) => {
      if (orderSelect.value !== "manual") return;
      // Permitir scroll con la rueda aunque haya selección
      // No bloquear el evento wheel
      const clickedIndex = parseInt(frame.dataset.index);
      handleSelectionSwap(frame, clickedIndex);
    });

    frame.addEventListener("dragstart", handleDragStart);
    frame.addEventListener("dragover", handleDragOver);
    frame.addEventListener("dragleave", handleDragLeave);
    frame.addEventListener("drop", handleDrop);
    frame.addEventListener("dragend", handleDragEnd);

    frameImagenes.appendChild(frame);
  });

  // Permitir scroll con la rueda del mouse sobre el área de imágenes (solo una vez, y siempre al frente)
  if (!frameImagenes._wheelScrollEnabled) {
    frameImagenes.addEventListener(
      "wheel",
      function (e) {
        // Siempre permitir el scroll, sin importar selección
        if (frameImagenes.scrollHeight > frameImagenes.clientHeight) {
          e.preventDefault();
          frameImagenes.scrollTop += e.deltaY;
        }
      },
      { passive: false }
    );
    frameImagenes._wheelScrollEnabled = true;
  }
}

function handleDragStart(e) {
  // Permitir drag&drop en cualquier modo, pero si no es manual, cambiar a manual al soltar
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.dataset.index);
}

function handleDragOver(e) {
  e.preventDefault();
  this.classList.add("drag-over");
  e.dataTransfer.dropEffect = "move";

  // Scroll automático al arrastrar cerca del borde del contenedor
  const container = frameImagenes;
  const rect = container.getBoundingClientRect();
  const mouseY = e.clientY;
  const scrollStep = 30;
  if (mouseY - rect.top < 40) {
    container.scrollTop -= scrollStep;
  } else if (rect.bottom - mouseY < 40) {
    container.scrollTop += scrollStep;
  }
}

function handleDragLeave() {
  this.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove("drag-over");

  // Si el select no está en manual, cambiarlo a manual al soltar
  if (orderSelect.value !== "manual") {
    orderSelect.value = "manual";
  }

  const draggedIndex = parseInt(e.dataTransfer.getData("text/plain"));
  const targetIndex = parseInt(this.dataset.index);

  if (draggedIndex !== targetIndex) {
    const [movedFile] = loadedFiles.splice(draggedIndex, 1);
    loadedFiles.splice(targetIndex, 0, movedFile);
    updateImageDisplay();
  }
}

function handleDragEnd() {
  this.classList.remove("dragging");
}

function handleSelectionSwap(frame, clickedIndex) {
  if (selectedElement === null) {
    selectedElement = { frame, index: clickedIndex };
    frame.classList.add("selected");
  } else if (selectedElement.index === clickedIndex) {
    selectedElement.frame.classList.remove("selected");
    selectedElement = null;
  } else {
    // Si el select no está en manual, cambiarlo a manual al hacer swap
    if (orderSelect.value !== "manual") {
      orderSelect.value = "manual";
    }
    const targetIndex = clickedIndex;
    const sourceIndex = selectedElement.index;
    const [movedFile] = loadedFiles.splice(sourceIndex, 1);
    loadedFiles.splice(targetIndex, 0, movedFile);
    selectedElement.frame.classList.remove("selected");
    selectedElement = null;
    updateImageDisplay();
  }
}

async function generatePdfDownload() {
  // Eliminar mensajes previos
  const errorMsgId = "input-error-msg";
  const removeErrorMsg = (input) => {
    const prev = input.parentElement.querySelector(`#${errorMsgId}`);
    if (prev) prev.remove();
    input.classList.remove("input-error");
  };
  removeErrorMsg(pdfFilenameInput);
  removeErrorMsg(pdfTitleInput);

  if (loadedFiles.length === 0) {
    // Mensaje inline en el input de archivo
    const msg = document.createElement("div");
    msg.id = errorMsgId;
    msg.textContent = "Carga al menos una imagen";
    msg.style = "color:#dc3545;font-size:0.85em;margin-top:4px;";
    frameImagenes.parentElement.insertBefore(
      msg,
      frameImagenes.parentElement.firstChild
    );
    setTimeout(() => {
      if (msg.parentElement) msg.remove();
    }, 2500);
    return;
  }

  const filename = pdfFilenameInput.value.trim();
  if (!filename) {
    // Mensaje inline en el input de nombre
    const msg = document.createElement("div");
    msg.id = errorMsgId;
    msg.textContent = "Ingresa un nombre para el PDF";
    msg.style = "color:#dc3545;font-size:0.85em;margin-top:4px;";
    pdfFilenameInput.classList.add("input-error");
    pdfFilenameInput.parentElement.appendChild(msg);
    pdfFilenameInput.focus();
    setTimeout(() => {
      removeErrorMsg(pdfFilenameInput);
    }, 2500);
    return;
  }

  loaderOverlay.style.display = "block";
  generatePdfBtn.disabled = true;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  const docWidth = 210;
  const docHeight = 297;
  const MARGIN_MM = 15;
  const PAGINATION_Y_MM = docHeight - 10;

  const HEADER_HEIGHT_PX = 40;
  const HEADER_HEIGHT_MM = (HEADER_HEIGHT_PX * 25.4) / 96;
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
    logoIzquierdo.src = "logo_izquierdo.png";
    await new Promise((resolve) => (logoIzquierdo.onload = resolve));
    const logoDerecho = new Image();
    logoDerecho.src = "logo_derecho.png";
    await new Promise((resolve) => (logoDerecho.onload = resolve));

    const totalPages = Math.ceil(loadedFiles.length / IMAGENES_POR_PAGINA);

    const addHeaderAndFooter = (pageNumber) => {
      let headerY = HEADER_Y_START;

      const centerY = headerY + HEADER_HEIGHT_MM / 2;

      if (logoIzquierdo.src) {
        const aspectRatio = logoIzquierdo.width / logoIzquierdo.height;
        const logoHeight = HEADER_HEIGHT_MM;
        const logoWidth = logoHeight * aspectRatio;
        const xLogoIzq = MARGIN_MM;
        pdf.addImage(
          logoIzquierdo,
          "PNG",
          xLogoIzq,
          headerY,
          logoWidth,
          logoHeight
        );
      }

      pdf.setFontSize(16);
      const textY =
        centerY +
        (pdf.internal.getFontSize() * 0.35) / pdf.internal.scaleFactor;
      const documentTitle = pdfTitleInput.value.trim() || "REPORTE FOTOGRÁFICO";
      pdf.text(documentTitle, docWidth / 2, textY, {
        align: "center",
      });

      if (logoDerecho.src) {
        const aspectRatio = logoDerecho.width / logoDerecho.height;
        const logoHeight = HEADER_HEIGHT_MM;
        const logoWidth = logoHeight * aspectRatio;
        const xLogoDer = docWidth - MARGIN_MM - logoWidth;
        pdf.addImage(
          logoDerecho,
          "PNG",
          xLogoDer,
          headerY,
          logoWidth,
          logoHeight
        );
      }

      const lineY = headerY + HEADER_HEIGHT_MM + HEADER_LINE_SPACE_MM;
      pdf.line(MARGIN_MM, lineY, docWidth - MARGIN_MM, lineY);

      pdf.setFontSize(8);
      pdf.text(
        `Página ${pageNumber} de ${totalPages}`,
        docWidth / 2,
        PAGINATION_Y_MM,
        { align: "center" }
      );

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
      await new Promise((resolve) => (img.onload = resolve));

      const dataUrl = fileData.url;

      pdf.addImage(
        dataUrl,
        "JPEG",
        currentX,
        yOffset,
        imgWidth,
        imgHeight,
        null,
        "FAST"
      );

      if (currentX === startX) {
        currentX += imgWidth + hGap;
      } else {
        currentX = startX;
        yOffset += imgHeight + vGap;
      }
    }

    const defaultFilename =
      pdfFilenameInput.value.trim() || "Registro_Fotografico";

    const pdfBlob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${defaultFilename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);

    clearAll();
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    alert(
      "Ocurrió un error al generar el PDF. Asegúrate de que los archivos 'logo_izquierdo.png' y 'logo_derecho.png' estén en la misma carpeta y de que estás utilizando un servidor web local (http://) para evitar errores de CORS."
    );
  } finally {
    loaderOverlay.style.display = "none";
    generatePdfBtn.disabled = false;
  }
}
