var BinaryConcatenater = (function() {
  /*
   * JSON Schema (extended with TypedArray)
   * {
   *   "name": "AudioMessage",
   *   "properties": {
   *     "user_id": {
   *       "type": "Uint32Array",
   *       "description": "user id of original sender",
   *       "required": true
   *     },
   *     "ch_num": {
   *       "type": "Uint8Array",
   *       "description": "number of channels",
   *       "required": true
   *     }
   *     "buffer_length": {
   *       "type": "Uint32Array",
   *       "descriptoin": "audio buffer length",
   *       "required": true
   *     },
   *     "buffer_array": {
   *       "type": "array",
   *       "description": "concatenated array of audio buffers through all channels",
   *       "required": true
   *       "items": {
   *         "type": "Float32Array",
   *         "description": "audio buffer"
   *       }
   *     }
   *   }
   * }
   */
  var BinaryConcatenater = function(format) {
  };
  BinaryConcatenater.prototype = {
    createMessage: function(msg_obj) {
      var bl = msg_obj.buffer_length;
      var ch_num = msg_obj.buffer_array.length;
      var ab = new ArrayBuffer(4 + 1 + 4 + (bl * ch_num * 4));
      var view = new DataView(ab);
      var offset = 0;
      view.setUint32(offset, msg_obj.user_id);
      offset += 4;
      view.setUint8(offset, ch_num);
      offset += 1;
      view.setUint32(offset, bl);
      offset += 4;
      for (var i = 0; i < ch_num; i++) {
        for (var j = 0; j < bl; j++) {
          view.setFloat32(offset, msg_obj.buffer_array[i][j]);
          offset += 4;
        }
      }
      return new Uint8Array(view.buffer);
    },
    parseMessage: function(bin_msg) {
      try {
        var offset = 0;
        var msg_obj = {};
        var view = new DataView(bin_msg);
        msg_obj.user_id = view.getUint32(0);
        offset += 4;
        msg_obj.ch_num = view.getUint8(4);
        offset += 1;
        msg_obj.buffer_length = view.getUint32(5);
        offset += 4;
        msg_obj.buffer_array = new Array(msg_obj.ch_num);
        for (var i = 0; i < msg_obj.ch_num; i++) {
          msg_obj.buffer_array[i] = new Float32Array(msg_obj.buffer_length)
          for (var j = 0; j < msg_obj.buffer_length; j++) {
            msg_obj.buffer_array[i][j] = view.getFloat32(offset);
            offset += 4;
          }
        }
        return msg_obj;
      } catch (e) {
        throw e;
      }
    }
  };

  return function(format) {
    return new BinaryConcatenater(format);
  } 
})();