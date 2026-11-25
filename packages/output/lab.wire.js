// lab.wire.js — @openav/output in the cheyuwu-lab runtime (declared in package.json → "lab").
// Runs inside the generated runtime/modules/output.js, with `lab` (window.lab) and every export of the declared files in scope.
// Exposes the kit and wires nothing: a lab work mirrors its own canvas to a projector from one of its buttons,
//   lab.output.openOutput(canvas, { name: 'front' })      (from a click: a browser opens a window only then)
// with the corner-pin (E), the test pattern (G), fullscreen (F) and the layout saved per name. Mode 'page', createOutputs()
// and the clean ?output address need a createShow() page: they stay with the framework's own pages.
lab.output = { openOutput, cornerPin, toMatrix3d, cropBox, parseOutputLayout, OUTPUT_FORMAT, outputParams, outputUrl };
