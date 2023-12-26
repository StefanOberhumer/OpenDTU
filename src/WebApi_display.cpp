
// SPDX-License-Identifier: GPL-2.0-or-later
/*
 * Copyright (C) 2022-2023 Thomas Basler and others
 */
#include "WebApi_display.h"
#include "Configuration.h"
#include "Display_Graphic.h"
#include "PinMapping.h"
#include "Utils.h"
#include "WebApi.h"
#include "WebApi_errors.h"
#include "helper.h"
#include <AsyncJson.h>
#include "MessageOutput.h"
void WebApiDisplayClass::init(AsyncWebServer& server, Scheduler& scheduler)
{
    using std::placeholders::_1;

    server.on("/api/display/getbuffer", HTTP_GET, std::bind(&WebApiDisplayClass::onDisplayBufferGet, this, _1));
}

void WebApiDisplayClass::onDisplayBufferGet(AsyncWebServerRequest* request)
{
    #define DISPLAY_BUFFER_MAX_LENGTH (128 * 64 / 8)

    /*
     TODO(stefan@obssys.com): Check that stuff
     if (!WebApi.checkCredentials(request)) {
        return;
    }*/

    AsyncJsonResponse* response = new AsyncJsonResponse();
    JsonObject root = response->getRoot();
    const PinMapping_t& pin = PinMapping.get();

    uint8_t displayType;
    uint8_t bufferTileHeight, bufferTileWidth;
    uint8_t displayHeight, displayWidth;
    uint8_t bufferContent[DISPLAY_BUFFER_MAX_LENGTH];
    char bufferContentAsHex[DISPLAY_BUFFER_MAX_LENGTH * 2 + 1];
    size_t bufferSize = std::size(bufferContent);

    Display.getDisplayInfo(displayType, displayHeight, displayWidth, bufferTileHeight, bufferTileWidth, bufferSize);
    Display.getBufferCopy(bufferSize, bufferContent);

    root["DisplayType"] = pin.display_type;
    root["DisplayHeight"] = displayHeight;
    root["DisplayWidth"] = displayWidth;
    root["BufferTileHeight"] = bufferTileHeight;
    root["BufferTileWidth"] = bufferTileWidth;
    root["BufferLength"] = bufferSize;

    // hexlify the binary buffer content
    // see if we get HEXBuilder.cpp within the esp32 framework and the use HEXBuilder::bytes2hex()
    for(size_t i = 0; i < bufferSize; i++) {
        sprintf(bufferContentAsHex + (i * 2), "%02x", bufferContent[i]);
    }
    //root["BufferContent"] = String(bufferContentAsHex);
    root["BufferContent"] = bufferContentAsHex;
    WebApi.sendJsonResponse(request, response, __FUNCTION__, __LINE__);
}
