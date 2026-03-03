export type SketchfabModel = {
  id: string;
  title: string;
  href: string;
  embedSrc: string;
};

function createEmbedSrc(id: string) {
  return `https://sketchfab.com/models/${id}/embed?autostart=1&preload=1&ui_infos=0&ui_controls=0&ui_stop=0&ui_help=0&ui_watermark=0&ui_hint=0&ui_theatre=1`;
}

export const CS2_AGENT_CT_MODEL: SketchfabModel = {
  id: "5dbf712384a3450f87ebbe502155df18",
  title: "FBI | CS2 Agent Model No1",
  href: "https://sketchfab.com/3d-models/fbi-cs2-agent-model-no1-5dbf712384a3450f87ebbe502155df18",
  embedSrc: createEmbedSrc("5dbf712384a3450f87ebbe502155df18")
};
