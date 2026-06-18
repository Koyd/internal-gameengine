package dev.framework.example;

import android.content.res.AssetManager;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.webkit.MimeTypeMap;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "FrameworkRuntime")
public class FrameworkRuntimePlugin extends Plugin {

    private static final String ASSET_ROOT = "public/app-assets";
    private RuntimeDatabase database;

    @Override
    public void load() {
        database = new RuntimeDatabase(getContext());
    }

    @PluginMethod
    public void invoke(PluginCall call) {
        JSObject request = call.getObject("request");
        if (request == null) {
            call.reject("Missing runtime request");
            return;
        }

        try {
            JSObject response = new JSObject();
            response.put("result", handle(request));
            call.resolve(response);
        } catch (RuntimeAssetException error) {
            JSObject response = new JSObject();
            response.put("result", runtimeFailure(error));
            call.resolve(response);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    private Object handle(JSObject request) throws JSONException, RuntimeAssetException {
        String tag = request.getString("_tag");
        if (tag == null) {
            throw new JSONException("Missing runtime request tag");
        }

        switch (tag) {
            case "Health":
                return new JSObject().put("status", "ok").put("runtime", "mobile:android");
            case "GetUserSetting":
                return getUserSetting(requiredString(request, "key"));
            case "SetUserSetting":
                return setUserSetting(requiredString(request, "key"), requiredString(request, "value"));
            case "ListAppStorageEntries":
                return listAppStorageEntries(requiredString(request, "appId"), requiredString(request, "collection"));
            case "AppendAppStorageEntry":
                return appendAppStorageEntry(
                    requiredString(request, "appId"),
                    requiredString(request, "collection"),
                    requiredString(request, "value")
                );
            case "ResolveAppAsset":
                return resolveAppAsset(requiredString(request, "appId"), requiredString(request, "path"));
            default:
                throw new JSONException("Unknown runtime request tag: " + tag);
        }
    }

    private JSObject getUserSetting(String key) {
        SQLiteDatabase db = database.getReadableDatabase();
        try (
            Cursor cursor = db.rawQuery("SELECT key, value, updated_at FROM user_settings WHERE key = ?", new String[] { key })
        ) {
            if (!cursor.moveToFirst()) {
                return null;
            }
            return userSetting(cursor.getString(0), cursor.getString(1), cursor.getString(2));
        }
    }

    private JSObject setUserSetting(String key, String value) {
        String updatedAt = Instant.now().toString();
        SQLiteDatabase db = database.getWritableDatabase();
        db.execSQL(
            "INSERT INTO user_settings (key, value, updated_at) VALUES (?, ?, ?) " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            new Object[] { key, value, updatedAt }
        );
        return userSetting(key, value, updatedAt);
    }

    private JSArray listAppStorageEntries(String appId, String collection) throws JSONException {
        SQLiteDatabase db = database.getReadableDatabase();
        JSArray entries = new JSArray();
        try (
            Cursor cursor = db.rawQuery(
                "SELECT id, app_id, collection, value, created_at FROM app_storage_entries " +
                "WHERE app_id = ? AND collection = ? ORDER BY id ASC",
                new String[] { appId, collection }
            )
        ) {
            while (cursor.moveToNext()) {
                entries.put(appStorageEntry(cursor));
            }
        }
        return entries;
    }

    private JSObject appendAppStorageEntry(String appId, String collection, String value) {
        String createdAt = Instant.now().toString();
        SQLiteDatabase db = database.getWritableDatabase();
        db.execSQL(
            "INSERT INTO app_storage_entries (app_id, collection, value, created_at) VALUES (?, ?, ?, ?)",
            new Object[] { appId, collection, value, createdAt }
        );
        long id = lastInsertRowId(db);
        return appStorageEntry(id, appId, collection, value, createdAt);
    }

    private JSObject resolveAppAsset(String appId, String rawPath) throws RuntimeAssetException {
        String normalizedPath = normalizeAssetPath(rawPath);
        String assetPath = ASSET_ROOT + "/" + appId + "/" + normalizedPath;
        AssetManager assets = getContext().getAssets();

        try (InputStream stream = assets.open(assetPath)) {
            long size = streamSize(stream);
            return new JSObject()
                .put("contentType", contentType(normalizedPath))
                .put("appId", appId)
                .put("path", normalizedPath)
                .put("size", size)
                .put("version", "asset-" + size);
        } catch (IOException error) {
            if (!assetExists(assets, ASSET_ROOT + "/" + appId)) {
                throw new RuntimeAssetException(appId, rawPath, "UnknownApp", "Unknown app assets: " + appId);
            }
            throw new RuntimeAssetException(appId, rawPath, "NotFound", "Asset not found: " + rawPath);
        }
    }

    private static JSObject userSetting(String key, String value, String updatedAt) {
        return new JSObject().put("key", key).put("value", value).put("updatedAt", updatedAt);
    }

    private static JSObject appStorageEntry(Cursor cursor) {
        return appStorageEntry(cursor.getLong(0), cursor.getString(1), cursor.getString(2), cursor.getString(3), cursor.getString(4));
    }

    private static JSObject appStorageEntry(long id, String appId, String collection, String value, String createdAt) {
        return new JSObject()
            .put("id", id)
            .put("appId", appId)
            .put("collection", collection)
            .put("value", value)
            .put("createdAt", createdAt);
    }

    private static JSObject runtimeFailure(RuntimeAssetException error) {
        return new JSObject().put("_tag", "RuntimeMobileFailure").put("error", error.toJson());
    }

    private static String requiredString(JSObject object, String key) throws JSONException {
        String value = object.getString(key);
        if (value == null || value.isEmpty()) {
            throw new JSONException("Missing required string: " + key);
        }
        return value;
    }

    private static String normalizeAssetPath(String path) throws RuntimeAssetException {
        String normalized = path.startsWith("://assets/") ? path.substring("://assets/".length()) : path;
        normalized = normalized.startsWith("/") ? normalized.substring(1) : normalized;
        if (normalized.isEmpty() || normalized.contains("\0")) {
            throw new RuntimeAssetException("", path, "InvalidPath", "Invalid asset path: " + path);
        }
        for (String part : normalized.split("/")) {
            if (part.isEmpty() || part.equals(".") || part.equals("..")) {
                throw new RuntimeAssetException("", path, "InvalidPath", "Invalid asset path: " + path);
            }
        }
        return normalized;
    }

    private static String contentType(String path) {
        int index = path.lastIndexOf(".");
        String extension = index >= 0 ? path.substring(index + 1).toLowerCase(Locale.ROOT) : "";
        switch (extension) {
            case "glb":
                return "model/gltf-binary";
            case "gltf":
                return "model/gltf+json";
            case "gdshader":
                return "text/plain";
            default:
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                return mime == null ? "application/octet-stream" : mime;
        }
    }

    private static boolean assetExists(AssetManager assets, String path) {
        try {
            String[] children = assets.list(path);
            return children != null;
        } catch (IOException error) {
            return false;
        }
    }

    private static long streamSize(InputStream stream) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        long size = 0;
        int read;
        while ((read = stream.read(buffer)) != -1) {
            size += read;
        }
        return size;
    }

    private static long lastInsertRowId(SQLiteDatabase db) {
        try (Cursor cursor = db.rawQuery("SELECT last_insert_rowid()", null)) {
            cursor.moveToFirst();
            return cursor.getLong(0);
        }
    }

    private static final class RuntimeDatabase extends SQLiteOpenHelper {

        RuntimeDatabase(android.content.Context context) {
            super(context, new File(context.getFilesDir(), "framework.sqlite").getAbsolutePath(), null, 1);
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE IF NOT EXISTS user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)");
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS app_storage_entries (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "app_id TEXT NOT NULL, " +
                "collection TEXT NOT NULL, " +
                "value TEXT NOT NULL, " +
                "created_at TEXT NOT NULL)"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS app_storage_entries_lookup ON app_storage_entries (app_id, collection, id)"
            );
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            onCreate(db);
        }
    }

    private static final class RuntimeAssetException extends Exception {

        private final String appId;
        private final String path;
        private final String reason;

        RuntimeAssetException(String appId, String path, String reason, String message) {
            super(message);
            this.appId = appId;
            this.path = path;
            this.reason = reason;
        }

        JSONObject toJson() {
            return new JSObject()
                .put("appId", appId)
                .put("message", getMessage())
                .put("path", path)
                .put("reason", reason);
        }
    }
}
