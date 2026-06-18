import Capacitor
import UIKit

class FrameworkBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(FrameworkRuntimePlugin())
    }
}
