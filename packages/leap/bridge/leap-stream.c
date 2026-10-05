/* leap-stream.c — Ultraleap (Leap Motion) hand skeleton → one JSON line per frame on stdout.
 *
 * Lineage: ported from The Last Input, branch feat/hand-input (runner/hand/leap-stream.c,
 * 2026-10-05, Che-Yu Wu). Agreed between the two sessions: ONE Leap bridge per machine,
 * living here in open-audiovisual; The Last Input switches to this bridge (port 6437, /raw).
 * The frame line format below is theirs, byte for byte — /raw serves it verbatim.
 * Additions here: a status line when the service is unreachable, back-off instead of a
 * busy loop on poll errors, the background-frames policy, and one "info" line with the
 * service version (consumed by leap-bridge.mjs, never forwarded on /raw).
 *
 * Units: millimetres; origin = the sensor; Desktop mode (sensor facing up):
 * +y up, +x right, +z toward the player.
 *
 * One message per line:
 *   {"t":"status","service":true|false,"device":"serial"|null}
 *   {"t":"info","server":"5.20.0","client":"5.20.0"}
 *   {"t":"f","id":frameNo,"fps":trackingFps,"hands":[{
 *      "id","side":"L"|"R","conf","pinch","grab",
 *      "palm":[x,y,z],"vel":[x,y,z],"n":[normal],"dir":[direction],"w":palmWidth,
 *      "f":[[ 5 points: metacarpal start, metacarpal end, proximal end, intermediate end, tip ] × thumb→pinky],
 *      "ext":[5 × extended 0/1],"arm":[[elbow],[wrist]]
 *   }]}
 *
 * Build: node packages/leap/bridge/build.mjs (needs the Ultraleap Hand Tracking app; its SDK is inside).
 */
#include <stdio.h>
#include <stdint.h>
#include <unistd.h>
#include "LeapC.h"

static void vec(const LEAP_VECTOR *v) { printf("[%.1f,%.1f,%.1f]", v->x, v->y, v->z); }

static void hand_json(const LEAP_HAND *h) {
  printf("{\"id\":%u,\"side\":\"%s\",\"conf\":%.2f,\"pinch\":%.3f,\"grab\":%.3f,",
         h->id, h->type == eLeapHandType_Left ? "L" : "R", h->confidence,
         h->pinch_strength, h->grab_strength);
  printf("\"palm\":"); vec(&h->palm.position);
  printf(",\"vel\":"); vec(&h->palm.velocity);
  printf(",\"n\":[%.3f,%.3f,%.3f]", h->palm.normal.x, h->palm.normal.y, h->palm.normal.z);
  printf(",\"dir\":[%.3f,%.3f,%.3f]", h->palm.direction.x, h->palm.direction.y, h->palm.direction.z);
  printf(",\"w\":%.1f,\"f\":[", h->palm.width);
  for (int d = 0; d < 5; d++) {
    const LEAP_DIGIT *g = &h->digits[d];
    printf(d ? ",[" : "[");
    vec(&g->bones[0].prev_joint);
    for (int b = 0; b < 4; b++) { printf(","); vec(&g->bones[b].next_joint); }
    printf("]");
  }
  printf("],\"ext\":[");
  for (int d = 0; d < 5; d++) printf(d ? ",%u" : "%u", h->digits[d].is_extended ? 1u : 0u);
  printf("],\"arm\":[");
  vec(&h->arm.prev_joint); printf(","); vec(&h->arm.next_joint);
  printf("]}");
}

static int last_service = -1;
static void status(int service, const char *device) {
  last_service = service;
  if (device) printf("{\"t\":\"status\",\"service\":%s,\"device\":\"%s\"}\n", service ? "true" : "false", device);
  else printf("{\"t\":\"status\",\"service\":%s,\"device\":null}\n", service ? "true" : "false");
}

static void info(LEAP_CONNECTION conn) {
  LEAP_VERSION s = {0}, c = {0};
  if (LeapGetVersion(conn, eLeapVersionPart_ServerLibrary, &s) != eLeapRS_Success) return;
  LeapGetVersion(conn, eLeapVersionPart_ClientLibrary, &c);
  printf("{\"t\":\"info\",\"server\":\"%d.%d.%d\",\"client\":\"%d.%d.%d\"}\n",
         s.major, s.minor, s.patch, c.major, c.minor, c.patch);
}

int main(void) {
  setvbuf(stdout, NULL, _IOLBF, 0);
  LEAP_CONNECTION conn;
  if (LeapCreateConnection(NULL, &conn) != eLeapRS_Success || LeapOpenConnection(conn) != eLeapRS_Success) {
    fprintf(stderr, "leap-stream: cannot open LeapC connection\n");
    status(0, NULL);
    return 1;
  }
  char serial[128];
  int errors = 0;
  for (;;) {
    LEAP_CONNECTION_MESSAGE msg;
    eLeapRS rs = LeapPollConnection(conn, 1000, &msg);
    if (rs != eLeapRS_Success) {
      if (rs == eLeapRS_Timeout) continue;
      // service not running / restarting: say so once, then back off instead of spinning
      if (++errors == 3 && last_service != 0) status(0, NULL);
      usleep(errors < 10 ? 50000 : 250000);
      continue;
    }
    errors = 0;
    switch (msg.type) {
      case eLeapEventType_Connection:
        LeapSetPolicyFlags(conn, eLeapPolicyFlag_BackgroundFrames, 0);  // frames even when no window is focused
        status(1, NULL);
        info(conn);
        break;
      case eLeapEventType_ConnectionLost: status(0, NULL); break;
      case eLeapEventType_Device: {
        LEAP_DEVICE dev;
        LEAP_DEVICE_INFO dinfo = { sizeof(dinfo) };
        dinfo.serial = serial; dinfo.serial_length = sizeof(serial);
        serial[0] = 0;
        if (LeapOpenDevice(msg.device_event->device, &dev) == eLeapRS_Success) {
          LeapGetDeviceInfo(dev, &dinfo);
          LeapCloseDevice(dev);
        }
        status(1, serial[0] ? serial : "unknown");
        break;
      }
      case eLeapEventType_DeviceLost: status(1, NULL); break;
      case eLeapEventType_Tracking: {
        const LEAP_TRACKING_EVENT *e = msg.tracking_event;
        printf("{\"t\":\"f\",\"id\":%lld,\"fps\":%.0f,\"hands\":[", (long long)e->tracking_frame_id, e->framerate);
        for (uint32_t i = 0; i < e->nHands; i++) { if (i) printf(","); hand_json(&e->pHands[i]); }
        printf("]}\n");
        break;
      }
      default: break;
    }
  }
}
