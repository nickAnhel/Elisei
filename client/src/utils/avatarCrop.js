export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function getBaseScale(imageSize, viewportSize) {
    if (!imageSize) {
        return 1;
    }

    return Math.max(
        viewportSize / imageSize.width,
        viewportSize / imageSize.height,
    );
}

export function getRenderedSize(imageSize, scale, viewportSize) {
    const factor = getBaseScale(imageSize, viewportSize) * scale;

    return {
        width: imageSize.width * factor,
        height: imageSize.height * factor,
        factor,
    };
}

export function constrainOffset(offset, imageSize, scale, viewportSize) {
    if (!imageSize) {
        return offset;
    }

    const rendered = getRenderedSize(imageSize, scale, viewportSize);

    return {
        x: clamp(offset.x, viewportSize - rendered.width, 0),
        y: clamp(offset.y, viewportSize - rendered.height, 0),
    };
}

export function buildCenteredOffset(imageSize, scale, viewportSize) {
    const rendered = getRenderedSize(imageSize, scale, viewportSize);

    return {
        x: (viewportSize - rendered.width) / 2,
        y: (viewportSize - rendered.height) / 2,
    };
}

export function buildCropPayload(imageSize, scale, offset, viewportSize) {
    const { factor } = getRenderedSize(imageSize, scale, viewportSize);
    const cropSizePx = viewportSize / factor;
    const minDimension = Math.min(imageSize.width, imageSize.height);

    return {
        x: clamp((-offset.x) / factor / imageSize.width, 0, 1),
        y: clamp((-offset.y) / factor / imageSize.height, 0, 1),
        size: clamp(cropSizePx / minDimension, 0, 1),
    };
}
