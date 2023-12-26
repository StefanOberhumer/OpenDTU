# SPDX-License-Identifier: GPL-2.0-or-later
#
# Copyright (C) 2024 Stefan Oberhumer (stefan@obssys.com)
#

# This script checks the embedded files for gzipped files and
# sets the fields mTime and OS-Byte of gzip header to a fixed value
# to get reproduceable binary equal builds under
# Linux & Windows build environments


import os, struct


Import("env")


def set_gzip_header(filenames, mTime=None, osId=None):
    if mTime is None and osId is None:
        return

    if mTime is not None:
        mTimeBytes = struct.pack("<I", mTime)
    if osId is not None:
        osByte = struct.pack("<B", osId)

    for filename in filenames:
        filename = env.subst(filename)
        if not filename.endswith(".gz"):
            #continue
            pass # just validate the gzip header

        fp = open(filename, "rb")
        header = fp.read(10)
        fp.close()

        if len(header) != 10: # we read the full header
            continue
        if header[0] != 0x1f or header[1] != 0x8b: # gzip "magic" bytes
            continue

        if mTime is not None:
            updateMtime = header[4:8] != mTimeBytes
        else:
            updateMtime = False
        if osId is not None:
            updateOsByte = header[9] != osByte
        else:
            updateOsByte = False
        if not updateMtime and not updateOsByte:
            continue

        fp = open(filename, "rb+")
        if updateMtime:
            print("Changing MTime in gzip header of  '%s'." % filename)
            fp.seek(4, os.SEEK_SET)
            fp.write(mTimeBytes)
        if updateOsByte:
            print("Changing OS in gzip header of '%s'." % filename)
            fp.seek(9, os.SEEK_SET)
            fp.write(osByte)
        fp.close()


#print(env.Dump())
filenames = []
for file_type in ["embed_txtfiles", "embed_files"]:
    lines = env.GetProjectOption("board_build.%s" % file_type, "").splitlines()
    if not lines:
        continue

    for line in lines:
        line = line.strip()
        if line:
            filenames += [os.path.join("$PROJECT_DIR", line)]

set_gzip_header(filenames, None, 10)
