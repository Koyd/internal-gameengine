import Capacitor
import Foundation

@objc(FrameworkRuntimePlugin)
public class FrameworkRuntimePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FrameworkRuntimePlugin"
    public let jsName = "FrameworkRuntime"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "invoke", returnType: CAPPluginReturnPromise)
    ]

    private let assetRoot = "public/app-assets"
    private var store = RuntimeStore()

    public override func load() {
        store.load()
    }

    @objc func invoke(_ call: CAPPluginCall) {
        guard let request = call.getObject("request") else {
            call.reject("Missing runtime request")
            return
        }

        do {
            call.resolve(["result": try handle(request)])
        } catch let error as RuntimeAssetError {
            call.resolve(["result": runtimeFailure(error)])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    private func handle(_ request: JSObject) throws -> Any {
        guard let tag = request.getString("_tag") else {
            throw RuntimeError.message("Missing runtime request tag")
        }

        switch tag {
        case "Health":
            return ["status": "ok", "runtime": "mobile:ios"]
        case "GetUserSetting":
            return store.userSettings[try requiredString(request, "key")]?.json ?? NSNull()
        case "SetUserSetting":
            let setting = RuntimeStore.UserSetting(
                key: try requiredString(request, "key"),
                value: try requiredString(request, "value"),
                updatedAt: isoNow()
            )
            store.userSettings[setting.key] = setting
            store.save()
            return setting.json
        case "ListAppStorageEntries":
            let appId = try requiredString(request, "appId")
            let collection = try requiredString(request, "collection")
            return store.entries
                .filter { $0.appId == appId && $0.collection == collection }
                .sorted { $0.id < $1.id }
                .map(\.json)
        case "AppendAppStorageEntry":
            let entry = RuntimeStore.AppStorageEntry(
                id: store.nextEntryId,
                appId: try requiredString(request, "appId"),
                collection: try requiredString(request, "collection"),
                value: try requiredString(request, "value"),
                createdAt: isoNow()
            )
            store.nextEntryId += 1
            store.entries.append(entry)
            store.save()
            return entry.json
        case "ResolveAppAsset":
            return try resolveAppAsset(
                appId: try requiredString(request, "appId"),
                rawPath: try requiredString(request, "path")
            )
        default:
            throw RuntimeError.message("Unknown runtime request tag: \(tag)")
        }
    }

    private func resolveAppAsset(appId: String, rawPath: String) throws -> JSObject {
        let normalizedPath = try normalizeAssetPath(rawPath)
        let relativePath = "\(assetRoot)/\(appId)/\(normalizedPath)"
        guard let url = Bundle.main.url(forResource: relativePath, withExtension: nil) else {
            if Bundle.main.url(forResource: "\(assetRoot)/\(appId)", withExtension: nil) == nil {
                throw RuntimeAssetError(
                    appId: appId,
                    path: rawPath,
                    reason: "UnknownApp",
                    message: "Unknown app assets: \(appId)"
                )
            }
            throw RuntimeAssetError(appId: appId, path: rawPath, reason: "NotFound", message: "Asset not found: \(rawPath)")
        }

        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        let size = attributes[.size] as? NSNumber ?? 0
        return [
            "contentType": contentType(normalizedPath),
            "appId": appId,
            "path": normalizedPath,
            "size": size.intValue,
            "version": "asset-\(size.intValue)"
        ]
    }

    private func runtimeFailure(_ error: RuntimeAssetError) -> JSObject {
        [
            "_tag": "RuntimeMobileFailure",
            "error": [
                "appId": error.appId,
                "message": error.message,
                "path": error.path,
                "reason": error.reason
            ]
        ]
    }

    private func requiredString(_ object: JSObject, _ key: String) throws -> String {
        guard let value = object.getString(key), !value.isEmpty else {
            throw RuntimeError.message("Missing required string: \(key)")
        }
        return value
    }

    private func normalizeAssetPath(_ path: String) throws -> String {
        var normalized = path.hasPrefix("://assets/") ? String(path.dropFirst("://assets/".count)) : path
        if normalized.hasPrefix("/") {
            normalized.removeFirst()
        }
        if normalized.isEmpty || normalized.contains("\0") {
            throw RuntimeAssetError(appId: "", path: path, reason: "InvalidPath", message: "Invalid asset path: \(path)")
        }
        for part in normalized.split(separator: "/") {
            if part.isEmpty || part == "." || part == ".." {
                throw RuntimeAssetError(appId: "", path: path, reason: "InvalidPath", message: "Invalid asset path: \(path)")
            }
        }
        return normalized
    }

    private func contentType(_ path: String) -> String {
        switch URL(fileURLWithPath: path).pathExtension.lowercased() {
        case "glb":
            return "model/gltf-binary"
        case "gltf":
            return "model/gltf+json"
        case "gdshader":
            return "text/plain"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "png":
            return "image/png"
        case "webp":
            return "image/webp"
        case "json":
            return "application/json"
        default:
            return "application/octet-stream"
        }
    }

    private func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}

private enum RuntimeError: Error {
    case message(String)
}

private struct RuntimeAssetError: Error {
    let appId: String
    let path: String
    let reason: String
    let message: String
}

private struct RuntimeStore: Codable {
    struct UserSetting: Codable {
        let key: String
        let value: String
        let updatedAt: String

        var json: JSObject {
            ["key": key, "value": value, "updatedAt": updatedAt]
        }
    }

    struct AppStorageEntry: Codable {
        let id: Int
        let appId: String
        let collection: String
        let value: String
        let createdAt: String

        var json: JSObject {
            [
                "id": id,
                "appId": appId,
                "collection": collection,
                "value": value,
                "createdAt": createdAt
            ]
        }
    }

    var userSettings: [String: UserSetting] = [:]
    var entries: [AppStorageEntry] = []
    var nextEntryId = 1

    private var url: URL {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("FrameworkRuntime", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("runtime-store.json")
    }

    mutating func load() {
        guard let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(RuntimeStore.self, from: data)
        else {
            return
        }
        self = decoded
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else {
            return
        }
        try? data.write(to: url, options: [.atomic])
    }
}
